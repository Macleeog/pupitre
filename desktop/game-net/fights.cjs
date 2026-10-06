const combatState = require('./combat-state.cjs');

let fightId = null;
let sequence = 0;

function nextSeq() {
  return ++sequence;
}

function setFightId(id) {
  fightId = id;
  combatState.setFightId(id);
}

function clearFight() {
  fightId = null;
  combatState.reset();
  sequence = 0;
}

function handleMessage(type, direction, kind, fields, at) {
  if (!fightId) return;

  combatState.applyMessage(type, fields);

  const snapshot = combatState.getState();

  return {
    seq: nextSeq(),
    at,
    type,
    direction,
    kind,
    fightId,
    snapshot,
  };
}

module.exports = {
  setFightId,
  clearFight,
  handleMessage,
  getState: combatState.getState,
};
