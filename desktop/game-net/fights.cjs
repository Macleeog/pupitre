const { parseMessage, varintField, messageField } = require("./decode.cjs");

// Obfuscated Dofus 3 message types and field numbers, as mapped by Blitzkrieg 1.42 (MIT).
// Ankama renames them on game updates; when fights stop being detected, these need refreshing
// from a packet capture.
const CODES = {
  fightOrder: "jvt",
  turnStart: "jwd",
  turnEnd: "jwc",
  fightEnd: "jwe",
};
// Client requests only sent while it is the client's own turn (spell cast, end of turn),
// seen in every capture of 2026-09-29.
const OWN_TURN_REQUESTS = new Set(["jrj", "jvv"]);
const NO_FIGHTER = 18446744073709551615n;
const SAME_FIGHT_MS = 5000;
const SAME_TURN_MS = 1000;

function toNumber(value) {
  return value === undefined ? 0 : Number(BigInt.asIntN(64, value));
}

// Fight-end payload, read from real captures (2026-09-29):
//   4: duration in ms
//   5: one entry per fighter
//      1: { 4: { 3: { 1: { 1: xp } } }, 6: fighterId }
//      2: { 2: [ { 3: [ { 1: itemId, 4: quantity } ] } ], 3: kamas }
function fightResults(payload) {
  const results = [];
  for (const entry of payload.get(5) ?? []) {
    if (entry.wireType !== 2) continue;
    const fields = parseMessage(entry.raw);
    const fighter = messageField(fields, 1);
    const id = varintField(fighter, 6);
    if (id === undefined || id === NO_FIGHTER) continue;
    const xp = varintField(messageField(messageField(messageField(fighter, 4), 3), 1), 1);
    const loot = messageField(fields, 2);
    const items = [];
    for (const group of loot?.get(2) ?? []) {
      if (group.wireType !== 2) continue;
      for (const stack of parseMessage(group.raw)?.get(3) ?? []) {
        if (stack.wireType !== 2) continue;
        const item = parseMessage(stack.raw);
        const itemId = toNumber(varintField(item, 1));
        const quantity = toNumber(varintField(item, 4)) || 1;
        if (itemId > 0) items.push({ itemId, quantity });
      }
    }
    results.push({ fighterId: id.toString(), xp: toNumber(xp), kamas: toNumber(varintField(loot, 3)), items });
  }
  return results;
}

// Without a known own character, a lone rewarded fighter can only be the player (solo fight);
// with several, nobody is credited.
function markOwn(results, own) {
  const known = results.some((result) => own.has(result.fighterId));
  const rewarded = results.filter((result) => result.xp > 0 || result.kamas > 0 || result.items.length > 0);
  return results.map((result) => ({
    ...result,
    mine: known ? own.has(result.fighterId) : rewarded.length === 1 && rewarded[0] === result,
  }));
}

function fighterOrder(payload) {
  const ids = [];
  for (const entry of payload.get(1) ?? []) {
    if (entry.wireType !== 2) continue;
    const id = varintField(messageField(parseMessage(entry.raw), 2), 1);
    if (id !== undefined && id !== NO_FIGHTER) ids.push(id.toString());
  }
  return ids;
}

// Several accounts in one fight each receive the same messages on their own connection:
// events are merged so one fight counts once. Each connection plays one character, which is
// recognised when that connection acts during a turn.
function createFightTracker(emit) {
  const active = new Map();
  const currentTurn = new Map();
  const own = new Set();
  let lastStart = -Infinity;
  let lastEnd = -Infinity;
  let lastTurn = { id: null, at: 0 };

  const turn = (type, id, at) => {
    if (id === undefined || id === NO_FIGHTER) return;
    const fighterId = id.toString();
    if (type === "turn-start") {
      if (lastTurn.id === fighterId && at - lastTurn.at < SAME_TURN_MS) return;
      lastTurn = { id: fighterId, at };
    }
    emit({ type, fighterId, at });
  };

  return {
    handle(connection, message, at, direction = "in") {
      if (direction === "out") {
        const fighterId = currentTurn.get(connection);
        if (fighterId && OWN_TURN_REQUESTS.has(message.type)) own.add(fighterId);
        return;
      }
      const payload = parseMessage(message.value);
      if (!payload) return;
      if (message.type === CODES.fightOrder) {
        const order = fighterOrder(payload);
        if (order.length === 0) return;
        const known = active.has(connection);
        active.set(connection, order);
        if (!known && at - lastStart > SAME_FIGHT_MS) {
          lastStart = at;
          emit({ type: "fight-start", fighters: order.length, at });
        }
      } else if (message.type === CODES.turnStart) {
        const id = varintField(payload, 7);
        if (id === undefined || id === NO_FIGHTER) currentTurn.delete(connection);
        else currentTurn.set(connection, id.toString());
        turn("turn-start", id, at);
      } else if (message.type === CODES.turnEnd) {
        currentTurn.delete(connection);
        turn("turn-end", varintField(payload, 1), at);
      } else if (message.type === CODES.fightEnd) {
        active.delete(connection);
        currentTurn.delete(connection);
        if (at - lastEnd > SAME_FIGHT_MS) {
          lastEnd = at;
          emit({
            type: "fight-end",
            at,
            durationMs: toNumber(varintField(payload, 4)),
            results: markOwn(fightResults(payload), own),
            ownFighterIds: [...own],
          });
        }
      }
    },
    forget(connection) {
      active.delete(connection);
      currentTurn.delete(connection);
    },
    inFight() {
      return active.size > 0;
    },
    ownFighterIds() {
      return [...own];
    },
  };
}

module.exports = { CODES, createFightTracker };
