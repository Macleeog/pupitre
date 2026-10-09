// Read-only Comte Harebourg tracker. It never writes a packet back to the game.
// Message shapes are taken from captures of 2026-10-08 (jsq / jvj / jwj / kjl),
// from the September fight messages (jue / jwd), and checked again on 2026-10-09.
// That capture still carries the sheet (jwj / juo), the session id (jxi), cells (kjl),
// turns (jvj) and slides (jsq 4 / 5 / 8). It has no current/max life update: jue is
// gone, jsq 300 is a spell pair, and the sheet total (1050 for the player, 13000 for
// the Comte) does not move when damage lands. Without remaining HP the aim cell stays hidden.

const HAREBOURG_ID = 3416;
const GFX_ID = 993;
const MAP_WIDTH = 14;
const MAP_HEIGHT = 20;
const CELL_COUNT = MAP_WIDTH * MAP_HEIGHT * 2;

const WATCHED = new Set([
  "jwj",
  "juo",
  "kjl",
  "kkr",
  "jvj",
  "jwd",
  "jvt",
  "jvu",
  "jsq",
  "jue",
  "jwe",
  "jpo",
  "jqb",
  "jxi",
]);

// Sent by a client only on its own turn (September captures). jtd and jst are not: they also go out on monster turns.
const OWN_TURN = new Set(["jrj", "jvv"]);

// One damage result per element line. A cast that lands several lines sends several of these.
const DAMAGE_ACTIONS = new Set([91, 93, 94, 96, 97, 98, 99]);

const CELLS = buildCells();
const BY_POINT = new Map(CELLS.map((point, cell) => [`${point.x},${point.y}`, cell]));

function buildCells() {
  const cells = [];
  let startX = 0;
  let startY = 0;
  for (let row = 0; row < MAP_HEIGHT; row += 1) {
    for (let column = 0; column < MAP_WIDTH; column += 1) cells.push({ x: startX + column, y: startY + column });
    startX += 1;
    for (let column = 0; column < MAP_WIDTH; column += 1) cells.push({ x: startX + column, y: startY + column });
    startY -= 1;
  }
  return cells;
}

function pointFromCell(cell) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) return null;
  return CELLS[cell];
}

function cellFromPoint(x, y) {
  const cell = BY_POINT.get(`${x},${y}`);
  return cell === undefined ? null : cell;
}

function one(value) {
  if (Array.isArray(value)) return value.length ? value[0] : undefined;
  return value;
}

function asId(value) {
  const raw = one(value);
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "string" && /^-?\d+$/.test(raw)) return raw;
  return null;
}

function asCell(value) {
  const raw = one(value);
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > 559) return null;
  return raw;
}

function asName(value) {
  const raw = one(value);
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (!/^[\p{L}][\p{L}'’.-]{2,28}$/u.test(name)) return null;
  return name;
}

function asMonster(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;
  const keys = Object.keys(node);
  if (keys.length !== 3 || !("1" in node) || !("2" in node) || !("3" in node)) return null;
  const count = one(node["1"]);
  const grade = one(node["2"]);
  const id = one(node["3"]);
  if (count !== 1 || !Number.isInteger(grade) || grade < 1 || grade > 250) return null;
  if (!Number.isInteger(id) || id < 1 || id > 20000) return null;
  return id;
}

function isPlayer(id) {
  return typeof id === "string" && !id.startsWith("-");
}

// Papycha bands. 91 % starts the top band; 90 % is the band below.
// Returned value is the confusion itself, in counter-clockwise quarter-turns.
function rotationFromLife(current, max) {
  if (!Number.isInteger(current) || !Number.isInteger(max) || max < 1 || current <= 0 || current > max) return null;
  const percent = Math.floor((current * 100) / max);
  if (percent >= 91) return 3;
  if (percent >= 75) return 1;
  if (percent >= 46) return 2;
  if (percent >= 31) return 1;
  if (percent >= 1) return 3;
  return null;
}

function addMeleeLines(base, lines) {
  if (base === null || !Number.isInteger(lines) || lines < 0) return null;
  return (base + lines) % 4;
}

const ROTATION_TEXT = {
  0: "aligné",
  1: "90° ↺ contre-horaire",
  2: "180°",
  3: "90° ↻ horaire",
};

const AIM_TEXT = {
  0: "viser le Comte",
  1: "viser 90° ↻ horaire",
  2: "viser 180°",
  3: "viser 90° ↺ contre-horaire",
};

function rotationLabel(quarters) {
  if (quarters === null || quarters === undefined) return null;
  return ROTATION_TEXT[quarters & 3] ?? null;
}

function aimLabel(quarters) {
  if (quarters === null || quarters === undefined) return null;
  // AIM_TEXT is already the inverse of the confusion.
  return AIM_TEXT[quarters & 3] ?? null;
}

function rotate(dx, dy, quarters) {
  let x = dx;
  let y = dy;
  const steps = ((quarters % 4) + 4) % 4;
  for (let i = 0; i < steps; i += 1) {
    const nextX = -y;
    y = x;
    x = nextX;
  }
  return { x, y };
}

function adjacent(a, b) {
  const left = pointFromCell(a);
  const right = pointFromCell(b);
  if (!left || !right) return false;
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) === 1;
}

// Cell to click so a cast lands on the Comte. Null when the rotated cell leaves the map.
function aimCell(playerCell, comteCell, confusionQuarters) {
  const from = pointFromCell(playerCell);
  const to = pointFromCell(comteCell);
  if (!from || !to || confusionQuarters === null || confusionQuarters === undefined) return null;
  const aim = ((-confusionQuarters % 4) + 4) % 4;
  const delta = rotate(to.x - from.x, to.y - from.y, aim);
  const cell = cellFromPoint(from.x + delta.x, from.y + delta.y);
  if (cell === null) return null;
  const back = pointFromCell(cell);
  if (!back || back.x !== from.x + delta.x || back.y !== from.y + delta.y) return null;
  return cell;
}

function fighterInTitle(title, processName, names) {
  if (typeof processName !== "string" || !/^dofus/i.test(processName)) return null;
  if (typeof title !== "string" || title.length === 0) return null;
  const found = [];
  for (const name of names) {
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "u");
    if (pattern.test(title)) found.push(name);
  }
  return found.length === 1 ? found[0] : null;
}

function lifePair(current, max) {
  if (!Number.isInteger(current) || !Number.isInteger(max)) return null;
  if (current <= 0 || max < 500 || current > max || max > 200000) return null;
  return { current, max };
}

function sheetEntity(entity) {
  if (!entity || typeof entity !== "object") return null;
  const id = asId(entity["1"]);
  if (!id) return null;
  return {
    id,
    cell: asCell(entity["2"]?.[0]?.["3"]),
    name: asName(entity["3"]?.[0]?.["4"]?.[0]?.["5"]?.[0]?.["4"]),
    monsterId: asMonster(entity["3"]?.[0]?.["4"]?.[0]?.["6"]?.[0]?.["3"]?.[0]),
  };
}

function validRect(rect) {
  if (!rect || typeof rect !== "object") return null;
  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (width < 80 || height < 80 || x < -10000 || y < -10000) return null;
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

function sameRect(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}

// The logged-in character is whoever this Dofus connection is playing.
// A window title wins only when it names exactly one fighter. Breed and class are never read.
function chooseFollowed(roster, foreground, session) {
  const names = [];
  for (const row of roster) {
    if (row.name && !names.includes(row.name)) names.push(row.name);
  }
  const titled = fighterInTitle(foreground.title, foreground.processName, names);
  if (titled) return roster.find((row) => row.name === titled) ?? null;
  const ids = [];
  for (const id of session.values()) {
    if (roster.some((row) => row.id === id) && !ids.includes(id)) ids.push(id);
  }
  if (ids.length !== 1) return null;
  return roster.find((row) => row.id === ids[0]) ?? null;
}

function createHarebourgWatch(emit) {
  const fighters = new Map();
  const session = new Map();
  const turns = new Map();
  let foreground = { title: "", processName: "", rect: null };
  let gap = null;
  let at = 0;
  let lastKey = "";
  let lastView = null;

  const ensure = (id) => {
    let row = fighters.get(id);
    if (!row) {
      row = { id, name: null, cell: null, monsterId: null, life: null, lifeMax: null, melee: 0 };
      fighters.set(id, row);
    }
    return row;
  };

  const comte = () => {
    for (const row of fighters.values()) {
      if (row.monsterId === HAREBOURG_ID) return row;
    }
    return null;
  };

  const place = (id, cell, from) => {
    if (!id || cell === null) return;
    const row = ensure(id);
    if (from !== undefined && from !== null && row.cell !== null && row.cell !== from) {
      gap = { id, had: row.cell, from, to: cell };
    }
    row.cell = cell;
  };

  const clear = () => {
    fighters.clear();
    turns.clear();
    gap = null;
  };

  const noteSelf = (connection, id) => {
    if (!id || !isPlayer(id) || id.length < 4) return false;
    const key = connection == null ? "0" : String(connection);
    if (session.get(key) === id) return false;
    session.set(key, id);
    return true;
  };

  const readSheet = (fields) => {
    const list = Array.isArray(fields["1"]) ? fields["1"] : [];
    for (const entity of list) {
      const sheet = sheetEntity(entity);
      if (!sheet) continue;
      const row = ensure(sheet.id);
      if (sheet.cell !== null) row.cell = sheet.cell;
      if (sheet.name) row.name = sheet.name;
      if (sheet.monsterId) row.monsterId = sheet.monsterId;
    }
  };

  const readRows = (list, idKey, cellKey) => {
    if (!Array.isArray(list)) return;
    for (const row of list) {
      if (!row || typeof row !== "object") continue;
      place(asId(row[idKey]), asCell(row[cellKey]));
    }
  };

  const beginTurn = (id) => {
    if (!id) return;
    ensure(id).melee = 0;
  };

  const noteLife = (id, current, max, cell) => {
    const life = lifePair(current, max);
    if (!id || !life) return;
    const row = ensure(id);
    row.life = life.current;
    row.lifeMax = life.max;
    if (cell !== null) row.cell = cell;
  };

  const noteDamage = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const source = fighters.get(sourceId);
    const target = fighters.get(targetId);
    if (!source || !target || source.cell === null || target.cell === null) return;
    if (!adjacent(source.cell, target.cell)) return;
    target.melee += 1;
  };

  const readJsq = (fields) => {
    const action = one(fields["22"]);
    const source = asId(fields["36"]);
    if (action === 5) {
      const row = fields["5"]?.[0];
      if (row) place(asId(row["1"]), asCell(row["3"]), asCell(row["2"]));
    } else if (action === 8) {
      const row = fields["4"]?.[0];
      if (row) place(asId(row["1"]), asCell(row["3"]), asCell(row["2"]));
    } else if (action === 3001) {
      const row = fields["39"]?.[0];
      if (row) place(asId(row["2"]), asCell(row["4"]));
    } else if (action === 50) {
      const row = fields["10"]?.[0];
      if (row) place(asId(row["1"]), asCell(row["2"]));
    } else if (action === 51) {
      const row = fields["27"]?.[0];
      if (row) place(asId(row["1"]), asCell(row["2"]));
    } else if (action === 4) {
      const row = fields["20"]?.[0];
      if (row) place(asId(row["2"]), asCell(row["1"]));
    } else if (DAMAGE_ACTIONS.has(action)) {
      const row = fields["37"]?.[0];
      const amount = one(row?.["1"]);
      if (Number.isInteger(amount) && amount > 0) noteDamage(source, asId(row["5"]));
    }
  };

  const readJue = (fields) => {
    const action = one(fields["14"]);
    if (action === 300 && !fields["5"] && !fields["9"]) {
      const row = fields["24"]?.[0];
      const pair = row?.["2"]?.[0];
      noteLife(asId(row?.["6"]), one(pair?.["1"]), one(pair?.["2"]), asCell(row?.["7"]));
    } else if (action === 5) {
      const row = fields["4"]?.[0];
      if (row) place(asId(row["4"]), asCell(row["2"]), asCell(row["1"]));
    } else if (action === 3001) {
      const row = fields["13"]?.[0];
      if (row) place(asId(row["1"]), asCell(row["2"]));
    }
  };

  const describe = (row, boss) => {
    const base = rotationFromLife(row.life, row.lifeMax);
    const confusion = addMeleeLines(base, row.melee);
    const click = boss && confusion !== null ? aimCell(row.cell, boss.cell, confusion) : null;
    return {
      id: row.id,
      name: row.name,
      cell: row.cell,
      life: row.life,
      lifeMax: row.lifeMax,
      melee: row.melee,
      rotation: rotationLabel(confusion),
      aim: confusion === null ? null : aimLabel(confusion),
      aimCell: click,
    };
  };

  const publish = () => {
    const boss = comte();
    const roster = [];
    for (const row of fighters.values()) {
      if (!isPlayer(row.id)) continue;
      roster.push(describe(row, boss));
    }
    const followed = chooseFollowed(roster, foreground, session);
    let mark = null;
    if (followed && followed.aimCell !== null) {
      const point = pointFromCell(followed.aimCell);
      if (point) mark = { cell: followed.aimCell, x: point.x, y: point.y, name: followed.name };
    }
    const view = {
      type: "harebourg-state",
      at,
      active: Boolean(boss),
      gfxId: GFX_ID,
      comteCell: boss?.cell ?? null,
      followedId: followed?.id ?? null,
      unidentified: Boolean(boss) && !followed,
      fighters: roster,
      gap,
      mark,
      dofusWindow: foreground.rect,
    };
    const key = JSON.stringify({ ...view, at: 0 });
    if (key === lastKey) return;
    lastKey = key;
    lastView = view;
    emit(view);
  };

  return {
    handle(message, when, direction = "in", connection = "0") {
      if (!message || !message.type) return;
      const key = connection == null ? "0" : String(connection);
      if (direction === "out") {
        if (!OWN_TURN.has(message.type)) return;
        const turn = turns.get(key);
        if (!noteSelf(key, turn)) return;
        at = when || Date.now();
        publish();
        return;
      }
      if (!WATCHED.has(message.type)) return;
      at = when || Date.now();
      const fields = message.fields ?? {};
      if (message.type === "jpo" || message.type === "jqb" || message.type === "jwe") {
        clear();
      } else if (message.type === "jxi") {
        noteSelf(key, asId(fields["1"]));
      } else if (message.type === "jwj" || message.type === "juo") {
        readSheet(fields);
      } else if (message.type === "kjl") {
        readRows(fields["2"], "2", "3");
      } else if (message.type === "kkr") {
        readRows(fields["1"], "1", "4");
      } else if (message.type === "jvj") {
        const id = asId(fields["3"]);
        turns.set(key, id);
        beginTurn(id);
      } else if (message.type === "jwd") {
        const id = asId(fields["7"]);
        turns.set(key, id);
        beginTurn(id);
      } else if (message.type === "jsq") {
        readJsq(fields);
      } else if (message.type === "jue") {
        readJue(fields);
      }
      publish();
    },
    setForeground(title, processName, rect) {
      const next = {
        title: typeof title === "string" ? title : "",
        processName: typeof processName === "string" ? processName : "",
        rect: validRect(rect),
      };
      if (next.title === foreground.title && next.processName === foreground.processName && sameRect(next.rect, foreground.rect)) return;
      foreground = next;
      publish();
    },
    snapshot() {
      return lastView;
    },
  };
}

module.exports = {
  HAREBOURG_ID,
  GFX_ID,
  WATCHED,
  rotationFromLife,
  addMeleeLines,
  rotationLabel,
  aimLabel,
  aimCell,
  adjacent,
  fighterInTitle,
  pointFromCell,
  cellFromPoint,
  createHarebourgWatch,
};
