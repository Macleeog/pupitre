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

function sentence(monsters) {
  const names = [];
  for (const monster of monsters) {
    if (!names.includes(monster.name)) names.push(monster.name);
  }
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} est sur cette carte.`;
  if (names.length === 2) return `${names[0]} et ${names[1]} sont sur cette carte.`;
  return `${names.slice(0, -1).join(", ")} et ${names.at(-1)} sont sur cette carte.`;
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

// Group description, capture of 2026-09-30 (Sicogne): "4x3851x200|1x3838x200|…",
// field 8 is the group id. The same block is what the client attaches to a chat link.
function describedGroups(fields, depth, out) {
  if (!fields || depth > 8) return out;
  let composition = "";
  for (const entries of fields.values()) {
    for (const entry of entries) {
      if (entry.wireType !== 2 || entry.raw.length > 400) continue;
      const text = entry.raw.toString("utf8");
      if (/\d+x\d+x\d+/.test(text)) composition += text;
    }
  }
  if (composition) {
    const monsterIds = [...composition.matchAll(COMPOSITION)].map((match) => Number(match[2]));
    const groupId = signed(varintField(fields, 8));
    if (isGroup(groupId) && monsterIds.length > 0) out.push({ groupId: Number(groupId), monsterIds });
  }
  for (const entries of fields.values()) {
    for (const entry of entries) {
      if (entry.wireType !== 2 || entry.raw.length === 0 || entry.raw.length > 8192) continue;
      const nested = parseMessage(entry.raw);
      if (nested) describedGroups(nested, depth + 1, out);
    }
  }
  return out;
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
          for (const info of describedGroups(parseMessage(message.value), 0, [])) {
            const current = known.get(info.groupId);
            if (!current || current.length === 0) known.set(info.groupId, info.monsterIds);
          }
        }
      }
      consider(at, false);
    },
  };
}

module.exports = { ARCHMONSTERS, MONSTERS, createWantedWatch, monsterKind, readMap, sentence };
