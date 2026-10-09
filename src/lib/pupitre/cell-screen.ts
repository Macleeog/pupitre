// Iso coordinates of the 560 fight cells. Same layout as desktop/game-net/harebourg.cjs.
// The pixel placement is a shared calibration (origin + scale), not a character or a class.

const MAP_WIDTH = 14
const MAP_HEIGHT = 20
const CELL_COUNT = MAP_WIDTH * MAP_HEIGHT * 2

export type CellPoint = { x: number; y: number }

export type Calib = { sx: number; sy: number; ox: number; oy: number }

export const DEFAULT_CALIB: Calib = { sx: 32, sy: 16, ox: 0, oy: 0 }

const CELLS = buildCells()

function buildCells() {
  const cells: CellPoint[] = []
  let startX = 0
  let startY = 0
  for (let row = 0; row < MAP_HEIGHT; row += 1) {
    for (let column = 0; column < MAP_WIDTH; column += 1) cells.push({ x: startX + column, y: startY + column })
    startX += 1
    for (let column = 0; column < MAP_WIDTH; column += 1) cells.push({ x: startX + column, y: startY + column })
    startY -= 1
  }
  return cells
}

export function pointFromCell(cell: number): CellPoint | null {
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) return null
  return CELLS[cell]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function sanitizeCalib(value: unknown): Calib | null {
  if (!value || typeof value !== "object") return null
  const row = value as Partial<Calib>
  const sx = Number(row.sx)
  const ox = Number(row.ox)
  const oy = Number(row.oy)
  if (!Number.isFinite(sx) || !Number.isFinite(ox) || !Number.isFinite(oy)) return null
  const scale = clamp(Math.round(sx), 12, 72)
  return { sx: scale, sy: scale / 2, ox: clamp(Math.round(ox), -2400, 2400), oy: clamp(Math.round(oy), -2400, 2400) }
}

// Centers the map in the Dofus window, then applies the shared nudge.
export function projectCell(point: CellPoint, width: number, height: number, calib: Calib) {
  const dx = point.x - point.y
  const dy = point.x + point.y
  return {
    x: width / 2 + (dx - 19.5) * calib.sx + calib.ox,
    y: height * 0.42 + (dy - 13.5) * calib.sy + calib.oy,
  }
}

export function diamondPoints(cx: number, cy: number, rx: number, ry: number) {
  return `${cx},${cy - ry} ${cx + rx},${cy} ${cx},${cy + ry} ${cx - rx},${cy}`
}
