import test from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_CALIB, pointFromCell, projectCell, sanitizeCalib } from "./cell-screen.ts"

test("fight cells match the map used to aim", () => {
  assert.deepEqual(pointFromCell(296), { x: 13, y: -8 })
  assert.deepEqual(pointFromCell(229), { x: 13, y: -3 })
  assert.equal(pointFromCell(-1), null)
  assert.equal(pointFromCell(560), null)
  for (let cell = 0; cell < 560; cell += 1) assert.ok(pointFromCell(cell))
})

test("the shared calibration moves every character the same way", () => {
  const point = pointFromCell(296)!
  const base = projectCell(point, 800, 600, DEFAULT_CALIB)
  const nudged = projectCell(point, 800, 600, { ...DEFAULT_CALIB, ox: 40, oy: -10 })
  assert.equal(nudged.x, base.x + 40)
  assert.equal(nudged.y, base.y - 10)
  assert.deepEqual(sanitizeCalib({ sx: 1000, ox: 3.2, oy: -3.8 }), { sx: 72, sy: 36, ox: 3, oy: -4 })
  assert.equal(sanitizeCalib({ name: "Spanka" }), null)
})
