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
// events are merged so one fight counts once.
function createFightTracker(emit) {
  const active = new Map();
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
    handle(connection, message, at) {
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
        turn("turn-start", varintField(payload, 7), at);
      } else if (message.type === CODES.turnEnd) {
        turn("turn-end", varintField(payload, 1), at);
      } else if (message.type === CODES.fightEnd) {
        active.delete(connection);
        if (at - lastEnd > SAME_FIGHT_MS) {
          lastEnd = at;
          emit({
            type: "fight-end",
            at,
            durationMs: toNumber(varintField(payload, 4)),
            results: fightResults(payload),
          });
        }
      }
    },
    forget(connection) {
      active.delete(connection);
    },
    inFight() {
      return active.size > 0;
    },
  };
}

module.exports = { CODES, createFightTracker };
