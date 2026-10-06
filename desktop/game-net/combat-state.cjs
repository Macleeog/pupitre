const events = [];
const fighters = new Map();
let fightId = null;
let selectedCellId = null;
let currentTurn = null;

function pushEvent(type, at, fields) {
  events.push({ type, at, fields });
}

function getFighters() {
  return Array.from(fighters.values());
}

function getFighter(entityId) {
  return fighters.get(String(entityId));
}

function upsertFighter(entityId, partial) {
  const key = String(entityId);
  const existing = fighters.get(key) || { id: key, cellId: null };
  fighters.set(key, { ...existing, ...partial });
}

function applyJuu(fields) {
  if (!fields || !Array.isArray(fields['1']) || !Array.isArray(fields['2'])) return;
  const cellIds = fields['1'];
  const entityIds = fields['2'];
  for (let i = 0; i < Math.min(cellIds.length, entityIds.length); i++) {
    const cellId = cellIds[i];
    const entityId = entityIds[i];
    if (typeof cellId === 'number' && entityId != null) {
      upsertFighter(entityId, { cellId });
    }
  }
}

function applyJst(fields) {
  if (!fields || !Array.isArray(fields['2'])) return;
  const cellId = fields['2'][0];
  if (typeof cellId === 'number') {
    selectedCellId = cellId;
  }
}

function applyJuh(fields) {
  if (!fields || !Array.isArray(fields['1'])) return;
  const items = fields['1'];
  for (const item of items) {
    if (!item || !Array.isArray(item['1'])) continue;
    const inner = item['1'][0];
    if (!inner) continue;
    const cellId = inner['5']?.[0];
    const entityId = inner['6']?.[0] ?? inner['8']?.[0];
    if (entityId != null) {
      upsertFighter(entityId, { cellId: typeof cellId === 'number' ? cellId : null });
    }
  }
}

function applyJqk(fields) {
  if (!fields || !Array.isArray(fields['1'])) return;
  for (const entry of fields['1']) {
    if (!entry) continue;
    const entityId = entry['3']?.[0];
    const team = entry['1']?.[0];
    if (entityId != null) {
      upsertFighter(entityId, { team: typeof team === 'number' ? team : null });
    }
  }
}

function applyJvu(fields) {
  if (!fields || !Array.isArray(fields['1'])) return;
  const members = fields['1'];
  for (const m of members) {
    if (!m || !m['2']) continue;
    const arr = m['2'];
    for (const e of arr) {
      if (!e) continue;
      const entityId = e['1'];
      if (entityId != null) {
        upsertFighter(entityId, {});
      }
    }
  }
}

function applyJvj(fields) {
  if (!fields) return;
  const turn = fields['7']?.[0];
  if (typeof turn === 'number') {
    currentTurn = turn;
  }
}

function applyMessage(type, fields) {
  switch (type) {
    case 'juu':
      applyJuu(fields);
      break;
    case 'jst':
      applyJst(fields);
      break;
    case 'juh':
      applyJuh(fields);
      break;
    case 'jqk':
      applyJqk(fields);
      break;
    case 'jvu':
      applyJvu(fields);
      break;
    case 'jvj':
      applyJvj(fields);
      break;
  }
}

function reset() {
  events.length = 0;
  fighters.clear();
  fightId = null;
  selectedCellId = null;
  currentTurn = null;
}

function getState() {
  return {
    fightId,
    fighters: getFighters(),
    selectedCellId,
    currentTurn,
  };
}

module.exports = {
  pushEvent,
  applyMessage,
  reset,
  getState,
  getFighters,
  getFighter,
  setFightId(id) { fightId = id; },
};
