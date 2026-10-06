export function getHarebourgRotation(hpPercent: number, meleeHits: number): number {
  let base = 0;
  if (hpPercent >= 90) base = 90;
  else if (hpPercent >= 75) base = 180;
  else if (hpPercent >= 45) base = 270;
  else if (hpPercent >= 30) base = 90;
  else base = 180;
  return (base + meleeHits * 90) % 360;
}

export function rotateVector(dx: number, dy: number, rotationDeg: number): { dx: number; dy: number } {
  const r = (rotationDeg % 360 + 360) % 360;
  if (r === 0) return { dx, dy };
  if (r === 90) return { dx: -dy, dy: dx };
  if (r === 180) return { dx: -dx, dy: -dy };
  if (r === 270) return { dx: dy, dy: -dx };
  return { dx, dy };
}

export function getHarebourgTargetCell(
  playerCellX: number,
  playerCellY: number,
  targetCellX: number,
  targetCellY: number,
  hpPercent: number,
  meleeHits: number
): { x: number; y: number } {
  const dx = targetCellX - playerCellX;
  const dy = targetCellY - playerCellY;
  const rot = getHarebourgRotation(hpPercent, meleeHits);
  const v = rotateVector(dx, dy, rot);
  return { x: playerCellX + v.dx, y: playerCellY + v.dy };
}
