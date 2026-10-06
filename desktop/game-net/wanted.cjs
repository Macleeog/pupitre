const { parseMessage, varintField } = require("./decode.cjs");

// Monster ids of the "avis de recherche" quests (DofusDB category 6), plus the two
// Gumans and Atcham's three disguises (Chi, Fou, Mi). Names stay the French ones
// shown in game. Refreshed 2026-09-30.
const MONSTERS = require("./wanted-monsters.json");
// Archmonsters: DofusDB isMiniBoss. No id is in both lists; a quest monster would win anyway.
const ARCHMONSTERS = require("./archmonsters.json");
const BY_ID = new Map();
for (const monster of MONSTERS) BY_ID.set(monster.id, { ...monster, kind: "wanted" });
for (const monster of ARCHMONSTERS) {
  if (!BY_ID.has(monster.id)) BY_ID.set(monster.id, { ...monster, kind: "archi" });
}

// Monster groups use a negative contextual id around -20000. -1 is the fight sentinel, not a group.
const GROUP_MIN = -1000000n;
const GROUP_MAX = -1000n;
const COMPOSITION = /(\d+)x(\d+)x(\d+)/g;

function signed(value) {
  if (value === undefined) return undefined;
  return BigInt.asIntN(64, BigInt(value));
}

function isGroup(id) {
  return id !== undefined && id <= GROUP_MAX && id >= GROUP_MIN;
}

function place(coords) {
  if (!coords || !Number.isInteger(coords.x) || !Number.isInteger(coords.y)) return "";
  if (coords.world && coords.world !== 1) return `${coords.x},${coords.y}, sur un autre monde`;
  return `${coords.x},${coords.y}`;
}

function sentence(monsters, coords) {
  const names = [];
  for (const monster of monsters) {
    if (!names.includes(monster.name)) names.push(monster.name);
  }
  if (names.length === 0) return "";
  const where = place(coords);
  const tail = where ? `en ${where}` : "sur cette carte";
  if (names.length === 1) return `${names[0]} est ${tail}.`;
  if (names.length === 2) return `${names[0]} et ${names[1]} sont ${tail}.`;
  return `${names.slice(0, -1).join(", ")} et ${names.at(-1)} sont ${tail}.`;
}

function monsterKind(id) {
  return BY_ID.get(id)?.kind ?? null;
}

// A creature entry inside a monster group: field 2 is the monster id, field 3 its level.
function creatureIds(fields, depth, out) {
  if (!fields || depth > 8) return out;
  const monsterId = Number(varintField(fields, 2) ?? -1);
  const level = Number(varintField(fields, 3) ?? -1);
  if (BY_ID.has(monsterId) && level >= 1 && level <= 200) out.add(monsterId);
  for (const entries of fields.values()) {
    for (const entry of entries) {
      if (entry.wireType !== 2 || entry.raw.length === 0 || entry.raw.length > 8192) continue;
      const nested = parseMessage(entry.raw);
      if (nested) creatureIds(nested, depth + 1, out);
    }
  }
  return out;
}

// Map population, capture of 2026-09-30 (Ka'Youloud): jpo field 6 is the map,
// field 9 one actor. A monster group has a negative id in field 2.
function readMap(buf) {
  const fields = parseMessage(buf);
  if (!fields) return null;
  const mapRaw = varintField(fields, 6);
  const mapId = mapRaw === undefined ? null : Number(mapRaw);
  const groups = new Map();
  for (const entry of fields.get(9) ?? []) {
    if (entry.wireType !== 2) continue;
    const actor = parseMessage(entry.raw);
    if (!actor) continue;
    const id = signed(varintField(actor, 2));
    if (!isGroup(id)) continue;
    groups.set(Number(id), [...creatureIds(actor, 0, new Set())]);
  }
  return { mapId: mapId > 1000 ? mapId : null, groups };
}

function movementGroup(message) {
  if (message.type !== "joq") return null;
  const id = signed(varintField(parseMessage(message.value), 3));
  return isGroup(id) ? Number(id) : null;
}

function mapFromPath(message) {
  if (message.type !== "jpt") return null;
  const id = Number(varintField(parseMessage(message.value), 3) ?? 0);
  return id > 1000 ? id : null;
}

function compositionText(fields) {
  let composition = "";
  for (const entries of fields.values()) {
    for (const entry of entries) {
      if (entry.wireType !== 2 || entry.raw.length > 400) continue;
      const text = entry.raw.toString("utf8");
      if (/\d+x\d+x\d+/.test(text)) composition += text;
    }
  }
  return composition;
}

function monsterIdsFrom(composition) {
  return [...composition.matchAll(COMPOSITION)].map((match) => Number(match[2]));
}

// Chat link for a monster group, capture of 2026-09-30: field 2 is { 1: x, 2: y }.
// Those are the group's coordinates, not the map the player is standing on.
function coordinatePair(fields) {
  const entry = fields.get(2)?.[0];
  if (!entry || entry.wireType !== 2 || entry.raw.length > 24) return null;
  const point = parseMessage(entry.raw);
  if (!point) return null;
  const xRaw = varintField(point, 1);
  const yRaw = varintField(point, 2);
  if (xRaw === undefined || yRaw === undefined) return null;
  for (const [field, entries] of point) {
    if (field !== 1 && field !== 2) return null;
    if (entries.some((item) => item.wireType !== 0)) return null;
  }
  const x = Number(signed(xRaw));
  const y = Number(signed(yRaw));
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (x < -256 || x > 256 || y < -256 || y > 256) return null;
  return { x, y };
}

// Same block, capture of 2026-09-30: field 4 is the world map (1 = Monde des Douze).
// 7,9 on world 14 is not 7,9 on world 1. /travel only knows the world the player is on.
function worldId(fields) {
  const world = Number(varintField(fields, 4) ?? 0);
  if (!Number.isInteger(world) || world < 1 || world > 64) return null;
  return world;
}

// Group description, capture of 2026-09-30 (Sicogne): "4x3851x200|1x3838x200|…",
// field 8 is the group id. A chat link of the same shape also carries coordinates.
function describedGroups(fields, depth, local, remote) {
  if (!fields || depth > 8) return;
  const composition = compositionText(fields);
  if (composition) {
    const monsterIds = monsterIdsFrom(composition);
    const coords = coordinatePair(fields);
    if (coords && monsterIds.length > 0) {
      const world = worldId(fields);
      remote.push({ monsterIds, coords: world && world !== 1 ? { ...coords, world } : coords });
    }
    else {
      const groupId = signed(varintField(fields, 8));
      if (isGroup(groupId) && monsterIds.length > 0) local.push({ groupId: Number(groupId), monsterIds });
    }
  }
  for (const entries of fields.values()) {
    for (const entry of entries) {
      if (entry.wireType !== 2 || entry.raw.length === 0 || entry.raw.length > 8192) continue;
      const nested = parseMessage(entry.raw);
      if (nested) describedGroups(nested, depth + 1, local, remote);
    }
  }
}

function createWantedWatch(emit) {
  let mapId = null;
  const present = new Set();
  const known = new Map();
  const notified = new Set();

  const monstersOf = (ids) => {
    const found = [];
    for (const id of ids) {
      const monster = BY_ID.get(id);
      if (!monster || notified.has(monster.name) || found.some((entry) => entry.name === monster.name)) continue;
      found.push(monster);
    }
    return found;
  };

  const consider = (at, fromMap) => {
    const found = [];
    for (const groupId of present) {
      for (const monster of monstersOf(known.get(groupId) ?? [])) {
        if (!found.some((entry) => entry.name === monster.name)) found.push(monster);
      }
    }
    if (found.length > 0) {
      for (const monster of found) notified.add(monster.name);
      emit({
        type: "wanted-sighting",
        at,
        mapId,
        monsters: found.map((monster) => ({
          id: monster.id,
          name: monster.name,
          level: monster.level,
          gfxId: monster.gfxId,
          kind: monster.kind,
        })),
        text: sentence(found),
      });
      return;
    }
    // A second look at the same map must not clear an alert that is still true.
    if (!fromMap) return;
    for (const groupId of present) {
      for (const id of known.get(groupId) ?? []) {
        if (BY_ID.has(id)) return;
      }
    }
    emit({ type: "wanted-absent", at, mapId });
  };

  const announceRemote = (at, groups) => {
    for (const info of groups) {
      const found = [];
      for (const id of info.monsterIds) {
        const monster = BY_ID.get(id);
        if (!monster) continue;
        const key = `${monster.name}@${info.coords.x},${info.coords.y},${info.coords.world ?? 1}`;
        if (notified.has(key) || found.some((entry) => entry.name === monster.name)) continue;
        found.push(monster);
        notified.add(key);
      }
      if (found.length === 0) continue;
      emit({
        type: "wanted-sighting",
        at,
        mapId: null,
        coords: info.coords,
        monsters: found.map((monster) => ({
          id: monster.id,
          name: monster.name,
          level: monster.level,
          gfxId: monster.gfxId,
          kind: monster.kind,
        })),
        text: sentence(found, info.coords),
      });
    }
  };

  const changeMap = (next) => {
    if (!next || next === mapId) return;
    mapId = next;
    present.clear();
    known.clear();
    notified.clear();
  };

  return {
    handle(message, at) {
      if (!message?.value) return;
      if (message.type === "jpo" && message.value.length <= 65536) {
        const snap = readMap(message.value);
        if (snap) {
          if (snap.mapId) changeMap(snap.mapId);
          present.clear();
          known.clear();
          for (const [groupId, monsterIds] of snap.groups) {
            present.add(groupId);
            known.set(groupId, monsterIds);
          }
          consider(at, true);
          return;
        }
      }
      changeMap(mapFromPath(message));
      const groupId = movementGroup(message);
      if (groupId !== null) present.add(groupId);
      if (message.value.length <= 16384 && message.value.includes(0x78)) {
        const text = message.value.toString("latin1");
        if (/\d+x\d+x\d+/.test(text)) {
          const local = [];
          const remote = [];
          describedGroups(parseMessage(message.value), 0, local, remote);
          for (const info of local) {
            const current = known.get(info.groupId);
            if (!current || current.length === 0) known.set(info.groupId, info.monsterIds);
          }
          // A chat link names the group's own map. Its contextual id is not the one on this map.
          announceRemote(at, remote);
        }
      }
      consider(at, false);
    },
  };
}

module.exports = { ARCHMONSTERS, MONSTERS, createWantedWatch, monsterKind, readMap, sentence };
