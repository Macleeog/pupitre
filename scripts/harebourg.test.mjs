import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { readFileSync } from "node:fs"

const require = createRequire(import.meta.url)
const {
  rotationFromLife,
  addMeleeLines,
  rotationLabel,
  aimCell,
  adjacent,
  fighterInTitle,
  pointFromCell,
  cellFromPoint,
  createHarebourgWatch,
} = require("../desktop/game-net/harebourg.cjs")
const { parseWindowLine } = require("../desktop/foreground.cjs")

const SPAN = "86059122983"

function watch() {
  const events = []
  return { events, hare: createHarebourgWatch((event) => events.push(event)) }
}

function playerSheet(cell = 296) {
  return {
    type: "jwj",
    fields: {
      1: [
        {
          1: [SPAN],
          2: [{ 3: [cell] }],
          3: [{ 4: [{ 5: [{ 4: ["Spanka"] }] }] }],
        },
      ],
    },
  }
}

function comteSheet(cell = 229) {
  return {
    type: "jwj",
    fields: {
      1: [
        {
          1: [-9],
          2: [{ 3: [cell] }],
          3: [{ 4: [{ 6: [{ 3: [{ 1: [1], 2: [220], 3: [3416] }] }] }] }],
        },
      ],
    },
  }
}

function life(current, max, cell = 296) {
  return {
    type: "jue",
    fields: {
      14: [300],
      24: [{ 2: [{ 1: [current], 2: [max] }], 6: [SPAN], 7: [cell] }],
    },
  }
}

test("life bands follow the published Harebourg table", () => {
  const band = (current) => rotationLabel(rotationFromLife(current, 100))
  assert.equal(band(100), "90° ↻ horaire")
  assert.equal(band(91), "90° ↻ horaire")
  assert.equal(band(90), "90° ↺ contre-horaire")
  assert.equal(band(75), "90° ↺ contre-horaire")
  assert.equal(band(74), "180°")
  assert.equal(band(46), "180°")
  assert.equal(band(45), "90° ↺ contre-horaire")
  assert.equal(band(31), "90° ↺ contre-horaire")
  assert.equal(band(30), "90° ↻ horaire")
  assert.equal(band(1), "90° ↻ horaire")
  assert.equal(rotationFromLife(0, 100), null)
})

test("melee lines accumulate instead of keeping only the last one", () => {
  const base = rotationFromLife(100, 100)
  assert.equal(rotationLabel(addMeleeLines(base, 1)), "aligné")
  assert.equal(rotationLabel(addMeleeLines(base, 2)), "90° ↺ contre-horaire")
  assert.notEqual(rotationLabel(addMeleeLines(base, 2)), rotationLabel(addMeleeLines(base, 1)))
  assert.equal(addMeleeLines(base, 4), base)
})

test("every map cell round-trips and a 180° aim is the symmetric cell", () => {
  for (let cell = 0; cell < 560; cell += 1) {
    const point = pointFromCell(cell)
    assert.equal(cellFromPoint(point.x, point.y), cell)
  }
  const player = pointFromCell(296)
  const comte = pointFromCell(229)
  const symmetric = cellFromPoint(2 * player.x - comte.x, 2 * player.y - comte.y)
  assert.equal(aimCell(296, 229, 0), 229)
  assert.equal(aimCell(296, 229, 2), symmetric)
  assert.equal(adjacent(296, cellFromPoint(player.x + 1, player.y)), true)
  assert.equal(adjacent(296, 229), false)
})

test("the October fight names Spanka, moves him on a throw, and ignores spell pairs as life", () => {
  const { hare, events } = watch()
  hare.handle(playerSheet(), 1)
  hare.handle(comteSheet(), 2)
  hare.handle(
    {
      type: "kjl",
      fields: { 2: [{ 2: [SPAN], 3: [296], 4: [5] }, { 2: [-9], 3: [229], 4: [3] }] },
    },
    3,
  )
  hare.handle(
    {
      type: "jsq",
      fields: {
        2: [{ 2: [{ 1: [33116], 2: [8395] }], 5: [296], 6: [SPAN] }],
        22: [300],
        36: [SPAN],
      },
    },
    4,
  )
  hare.setForeground("Spanka - Dofus", "Dofus")
  let view = events.at(-1)
  assert.equal(view.active, true)
  assert.equal(view.followedId, SPAN)
  assert.equal(view.unidentified, false)
  assert.equal(view.fighters[0].name, "Spanka")
  assert.equal(view.fighters[0].life, null)
  assert.equal(view.fighters[0].aimCell, null)
  assert.equal(view.mark, null)

  hare.handle({ type: "jsq", fields: { 4: [{ 1: [SPAN], 2: [296], 3: [242] }], 22: [8], 36: [-9] } }, 5)
  view = events.at(-1)
  assert.equal(view.fighters[0].cell, 242)
  assert.equal(view.fighters[0].aimCell, null)

  hare.handle({ type: "jsq", fields: { 4: [{ 1: [SPAN], 2: [174], 3: [147] }], 22: [8], 36: [-9] } }, 6)
  view = events.at(-1)
  assert.equal(view.fighters[0].cell, 147)
  assert.deepEqual(view.gap, { id: SPAN, had: 242, from: 174, to: 147 })
})

test("a foreground Dofus window selects that character, and anything else selects nobody", () => {
  const { hare, events } = watch()
  hare.handle(playerSheet(), 1)
  hare.handle(comteSheet(), 2)
  hare.handle(life(8395, 33116), 3)
  hare.setForeground("Spanka - Dofus", "Dofus")
  assert.equal(events.at(-1).followedId, SPAN)
  assert.equal(events.at(-1).fighters[0].rotation, "90° ↻ horaire")
  assert.equal(events.at(-1).unidentified, false)
  assert.equal(typeof events.at(-1).fighters[0].aimCell, "number")
  assert.equal(events.at(-1).mark.cell, events.at(-1).fighters[0].aimCell)
  assert.equal(events.at(-1).mark.name, "Spanka")

  hare.setForeground("Spanka - DofusDB", "chrome")
  assert.equal(events.at(-1).followedId, null)
  assert.equal(events.at(-1).unidentified, true)
  assert.equal(fighterInTitle("Idozo et Spanka - Dofus", "Dofus", ["Idozo", "Spanka"]), null)
  assert.equal(fighterInTitle("Dofus", "Dofus", ["Spanka"]), null)
})

test("two adjacent damage lines stack, and a throw moves the aim cell", () => {
  const { hare, events } = watch()
  const here = pointFromCell(296)
  const beside = cellFromPoint(here.x + 1, here.y)
  hare.handle(playerSheet(296), 1)
  hare.handle(comteSheet(229), 2)
  hare.handle(
    {
      type: "jwj",
      fields: { 1: [{ 1: [-10], 2: [{ 3: [beside] }] }] },
    },
    3,
  )
  hare.handle(life(1000, 1000, 296), 4)
  const before = events.at(-1).fighters[0].aimCell
  const hit = {
    type: "jsq",
    fields: { 22: [97], 36: [-10], 37: [{ 1: [80], 4: [1], 5: [SPAN] }] },
  }
  hare.handle(hit, 5)
  hare.handle(hit, 6)
  const stacked = events.at(-1).fighters[0]
  assert.equal(stacked.melee, 2)
  assert.equal(stacked.rotation, "90° ↺ contre-horaire")
  hare.handle({ type: "jvj", fields: { 3: [SPAN], 7: [4] } }, 7)
  assert.equal(events.at(-1).fighters[0].melee, 0)
  assert.equal(events.at(-1).fighters[0].rotation, "90° ↻ horaire")
  hare.handle({ type: "jsq", fields: { 22: [3001], 36: [-9], 39: [{ 2: [SPAN], 4: [242] }] } }, 8)
  assert.equal(events.at(-1).fighters[0].cell, 242)
  assert.notEqual(events.at(-1).fighters[0].aimCell, before)
})

test("a map change drops the previous Comte, so a reused id is not him", () => {
  const { hare, events } = watch()
  hare.handle(comteSheet(), 1)
  assert.equal(events.at(-1).active, true)
  hare.handle({ type: "jpo", fields: { 6: [1] } }, 2)
  assert.equal(events.at(-1).active, false)
  hare.handle({ type: "kjl", fields: { 2: [{ 2: [-9], 3: [320], 4: [3] }] } }, 3)
  assert.equal(events.at(-1).active, false)
})

function allySheet(id, name, cell) {
  return {
    type: "jwj",
    fields: {
      1: [
        {
          1: [id],
          2: [{ 3: [cell] }],
          3: [{ 4: [{ 5: [{ 4: [name] }] }] }],
        },
      ],
    },
  }
}

test("the played character comes from the Dofus session, and the name is whatever the sheet says", () => {
  const source = readFileSync(new URL("../desktop/game-net/harebourg.cjs", import.meta.url), "utf8")
  assert.equal(source.includes("Spanka"), false)
  assert.equal(source.includes("Iop"), false)

  const { hare, events } = watch()
  const other = "241027711271"
  hare.handle(playerSheet(), 1, "in", "c1")
  hare.handle(allySheet(other, "Idozo", 313), 2, "in", "c1")
  hare.handle(comteSheet(), 3, "in", "c1")
  hare.handle({ type: "jxi", fields: { 1: [SPAN] } }, 4, "in", "c1")
  hare.handle(life(8395, 33116), 5, "in", "c1")
  hare.setForeground("Dofus", "Dofus", { x: 10, y: 20, width: 1280, height: 720 })
  let view = events.at(-1)
  assert.equal(view.followedId, SPAN)
  assert.equal(view.unidentified, false)
  assert.equal(view.fighters.find((row) => row.id === SPAN).name, "Spanka")
  assert.equal(view.mark.name, "Spanka")
  assert.equal(typeof view.mark.cell, "number")
  assert.deepEqual(view.dofusWindow, { x: 10, y: 20, width: 1280, height: 720 })

  hare.handle({ type: "jxi", fields: { 1: [other] } }, 6, "in", "c1")
  hare.handle(
    {
      type: "jue",
      fields: { 14: [300], 24: [{ 2: [{ 1: [5000], 2: [10000] }], 6: [other], 7: [313] }] },
    },
    7,
    "in",
    "c1",
  )
  view = events.at(-1)
  assert.equal(view.followedId, other)
  assert.equal(view.mark.name, "Idozo")
  assert.notEqual(view.mark.cell, events.find((row) => row.mark?.name === "Spanka").mark.cell)

  hare.handle({ type: "jxi", fields: { 1: [SPAN] } }, 8, "in", "c2")
  view = events.at(-1)
  assert.equal(view.followedId, null)
  assert.equal(view.unidentified, true)
  assert.equal(view.mark, null)

  hare.setForeground("Idozo - Dofus", "Dofus")
  view = events.at(-1)
  assert.equal(view.followedId, other)
  assert.equal(view.mark.name, "Idozo")
})

test("a Dofus window line carries the rectangle, and a minimized window does not", () => {
  assert.deepEqual(parseWindowLine("Dofus\tDofus\t12\t40\t1600\t900"), {
    processName: "Dofus",
    title: "Dofus",
    rect: { x: 12, y: 40, width: 1600, height: 900 },
  })
  assert.equal(parseWindowLine("Dofus\tLumi - Dofus\t-32000\t-32000\t160\t28").rect, null)
  assert.equal(parseWindowLine("Dofus\tLumi - Dofus\t0\t0\t10\t10").rect, null)
})

test("the 2026-10-09 fight still follows the session character and does not invent life", () => {
  const { hare, events } = watch()
  const player = "59884044583"
  hare.handle(
    {
      type: "jwj",
      fields: {
        1: [
          {
            1: [-1],
            2: [{ 3: [320] }],
            3: [{ 4: [{ 6: [{ 3: [{ 1: [1], 2: [220], 3: [3416] }] }] }] }],
          },
        ],
      },
    },
    1,
  )
  hare.handle(
    {
      type: "jwj",
      fields: {
        1: [
          {
            1: [player],
            2: [{ 3: [329] }],
            3: [{ 4: [{ 5: [{ 4: ["Mitarashii"] }] }] }],
          },
        ],
      },
    },
    2,
  )
  hare.handle({ type: "jxi", fields: { 1: [player] } }, 3, "in", "c1")
  hare.handle(
    {
      type: "kjl",
      fields: {
        2: [
          { 2: [player], 3: [329], 4: [7] },
          { 2: [-1], 3: [320], 4: [3] },
        ],
      },
    },
    4,
  )
  hare.handle(
    {
      type: "jsq",
      fields: {
        2: [{ 2: [{ 1: [57060], 2: [21976] }], 3: [1], 5: [316], 6: [player] }],
        22: [300],
        36: [player],
      },
    },
    5,
  )
  hare.setForeground("Dofus", "Dofus")
  let view = events.at(-1)
  assert.equal(view.active, true)
  assert.equal(view.comteCell, 320)
  assert.equal(view.followedId, player)
  assert.equal(view.unidentified, false)
  assert.equal(view.fighters[0].name, "Mitarashii")
  assert.equal(view.fighters[0].life, null)
  assert.equal(view.mark, null)

  hare.handle({ type: "jsq", fields: { 5: [{ 1: [player], 2: [398], 3: [411] }], 22: [5], 36: [-4] } }, 6)
  assert.equal(events.at(-1).fighters[0].cell, 411)
  hare.handle({ type: "jsq", fields: { 20: [{ 1: [360], 2: [player] }], 22: [4], 36: [player] } }, 7)
  assert.equal(events.at(-1).fighters[0].cell, 360)
  hare.handle({ type: "jvj", fields: { 2: [430], 3: [player], 4: [150], 7: [1] } }, 8)
  assert.equal(events.at(-1).fighters[0].melee, 0)
  assert.equal(events.at(-1).mark, null)
})

test("September slide uses from-cell and to-cell", () => {
  const { hare, events } = watch()
  hare.handle(playerSheet(174), 1)
  hare.handle({ type: "jue", fields: { 4: [{ 1: [174], 2: [147], 4: [SPAN] }], 11: [-5], 14: [5] } }, 2)
  assert.equal(events.at(-1).fighters[0].cell, 147)
})
