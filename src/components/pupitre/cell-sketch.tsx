import { diamondPoints, pointFromCell, projectCell, type Calib, type CellPoint } from "@/lib/pupitre/cell-screen";

export function CellSketch({
  playerCell,
  comteCell,
  aimCell,
}: {
  playerCell: number | null;
  comteCell: number | null;
  aimCell: number | null;
}) {
  if (aimCell === null) return null;
  const width = 280;
  const height = 148;
  const aim = pointFromCell(aimCell);
  if (!aim) return null;
  const player = playerCell === null ? null : pointFromCell(playerCell);
  const comte = comteCell === null ? null : pointFromCell(comteCell);
  const shown = [aim, player, comte].filter((point): point is CellPoint => point !== null);
  const xs = shown.map((point) => point.x - point.y);
  const ys = shown.map((point) => point.x + point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(6, maxX - minX);
  const spanY = Math.max(4, maxY - minY);
  const scale = Math.min((width - 48) / spanX, (height - 48) / spanY);
  const place = (point: CellPoint) => ({
    x: 24 + (point.x - point.y - minX) * scale,
    y: 24 + (point.x + point.y - minY) * scale,
  });
  const aimAt = place(aim);
  const rx = Math.max(10, scale * 0.42);
  const ry = rx * 0.56;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-32 w-full" aria-hidden="true">
      {player ? (
        <polygon points={diamondPoints(place(player).x, place(player).y, rx * 0.7, ry * 0.7)} className="fill-white/75" />
      ) : null}
      {comte ? (
        <polygon points={diamondPoints(place(comte).x, place(comte).y, rx * 0.7, ry * 0.7)} className="fill-white/30" />
      ) : null}
      <polygon points={diamondPoints(aimAt.x, aimAt.y, rx, ry)} className="fill-[#7CFF6B]/85 stroke-[#d6ff9a]" strokeWidth="2" />
    </svg>
  );
}

export function GameDiamond({
  point,
  width,
  height,
  calib,
}: {
  point: CellPoint;
  width: number;
  height: number;
  calib: Calib;
}) {
  if (width < 80 || height < 80) return null;
  const at = projectCell(point, width, height, calib);
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <polygon
        points={diamondPoints(at.x, at.y, calib.sx, calib.sy)}
        fill="rgba(124, 255, 107, 0.42)"
        stroke="#d6ff9a"
        strokeWidth="3"
      />
    </svg>
  );
}
