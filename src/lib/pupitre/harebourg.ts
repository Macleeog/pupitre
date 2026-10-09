// The desk does not use this file. The live Comte watch is desktop/game-net/harebourg.cjs:
// it names the character from the open Dofus window and draws the green cell there.
// These helpers only keep the old combat sketch compiling, on the public Papycha bands.
// Remaining HP percent is Math.floor(current * 100 / max). 0 HP has no rotation.

function confusionQuarters(hpPercent: number, meleeHits: number): number | null {
  const hp = Math.floor(hpPercent);
  if (hp <= 0) return null;
  const base = hp >= 91 ? 3 : hp >= 75 ? 1 : hp >= 46 ? 2 : hp >= 31 ? 1 : 3;
  return (base + meleeHits) % 4;
}

export function getHarebourgRotation(hpPercent: number, meleeHits: number): number {
  const confusion = confusionQuarters(hpPercent, meleeHits);
  if (confusion === null) return 0;
  return ((4 - confusion) % 4) * 90;
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
  meleeHits: number,
): { x: number; y: number } {
  const dx = targetCellX - playerCellX;
  const dy = targetCellY - playerCellY;
  const rot = getHarebourgRotation(hpPercent, meleeHits);
  const v = rotateVector(dx, dy, rot);
  return { x: playerCellX + v.dx, y: playerCellY + v.dy };
}
