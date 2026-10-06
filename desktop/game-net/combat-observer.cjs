const combatState = require('./combat-state.cjs');
const fights = require('./fights.cjs');

let fightActive = false;
let lastFightId = null;

const FIGHT_START_TYPES = new Set(['juh', 'jqk', 'jvu']);
const FIGHT_END_TYPES = new Set(['jvi', 'jtg']);

function detectFightStart(type, fields) {
  if (type === 'jvu' && fields && fields['1']) {
    const first = fields['1'][0];
    if (first && first['2'] && first['2'][0] && first['2'][0]['1']) {
      const id = first['2'][0]['1'];
      if (typeof id === 'string' && id.length > 10) {
        return id;
      }
    }
  }
  if (type === 'juh' && fields && fields['1']) {
    const item = fields['1'][0];
    if (item && item['1'] && item['1'][0] && item['1'][0]['8']) {
      const id = item['1'][0]['8'][0];
      if (typeof id === 'string' && id.length > 10) {
        return id;
      }
    }
  }
  return null;
}

function handleMessage(type, direction, kind, fields, at) {
  if (!fightActive) {
    const fightId = detectFightStart(type, fields);
    if (fightId) {
      fightActive = true;
      lastFightId = fightId;
      fights.setFightId(fightId);
    } else {
      return null;
    }
  }

  if (FIGHT_END_TYPES.has(type)) {
    fightActive = false;
    fights.clearFight();
    return null;
  }

  const result = fights.handleMessage(type, direction, kind, fields, at);
  return result;
}

function getState() {
  return fights.getState();
}

function reset() {
  fightActive = false;
  lastFightId = null;
  fights.clearFight();
}

module.exports = {
  handleMessage,
  getState,
  reset,
};
