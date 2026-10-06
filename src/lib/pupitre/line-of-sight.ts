export type Cell = { x: number; y: number; walkable: boolean };
export type Grid = Cell[][];

export function bresenhamLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return points;
}

export function hasLineOfSight(grid: Grid, x0: number, y0: number, x1: number, y1: number): boolean {
  const line = bresenhamLine(x0, y0, x1, y1);
  for (const [x, y] of line) {
    if (!grid[y]?.[x]?.walkable) return false;
  }
  return true;
}

export function getVisibleCells(
  grid: Grid,
  originX: number,
  originY: number,
  range: number
): [number, number][] {
  const visible: [number, number][] = [];
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > range) continue;
      const x = originX + dx;
      const y = originY + dy;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      if (hasLineOfSight(grid, originX, originY, x, y)) {
        visible.push([x, y]);
      }
    }
  }
  return visible;
}
