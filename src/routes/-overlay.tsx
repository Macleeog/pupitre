import { useEffect, useRef, useState, useCallback } from 'react';
import type { CombatSnapshot, FighterState } from '../lib/pupitre/combat-bridge';
import { getVisibleCells, bresenhamLine, type Grid, type Cell } from '../lib/pupitre/line-of-sight';
import { getHarebourgTargetCell } from '../lib/pupitre/harebourg';

const CELL_SIZE = 40;
const GRID_COLS = 50;
const GRID_ROWS = 30;

function buildGridFromFighters(fighters: FighterState[]): Grid {
  const grid: Grid = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < GRID_COLS; x++) row.push({ x, y, walkable: true });
    grid.push(row);
  }
  for (const f of fighters) {
    if (f.cellId == null) continue;
    const x = f.cellId % 100;
    const y = Math.floor(f.cellId / 100);
    if (y >= 0 && y < GRID_ROWS && x >= 0 && x < GRID_COLS) grid[y][x].walkable = false;
  }
  return grid;
}

export default function Overlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snapshot, setSnapshot] = useState<CombatSnapshot | null>(null);
  const [playerCell, setPlayerCell] = useState<{ x: number; y: number } | null>(null);
  const [spellRange, setSpellRange] = useState(6);
  const [harebourgMode, setHarebourgMode] = useState(false);
  const [hpPercent, setHpPercent] = useState(80);
  const [meleeHits, setMeleeHits] = useState(0);

  useEffect(() => {
    const api = window.pupitre;
    if (!api) return;
    return api.onCombatUpdate((next) => {
      setSnapshot(next);
      const candidate = next.fighters.find(f => f.cellId != null && f.team === 1) ?? next.fighters.find(f => f.cellId != null);
      if (candidate?.cellId != null) setPlayerCell({ x: candidate.cellId % 100, y: Math.floor(candidate.cellId / 100) });
    });
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!snapshot) return;

    const fighters = snapshot.fighters.filter(f => f.cellId != null);
    const grid = buildGridFromFighters(fighters);
    if (playerCell && !harebourgMode) {
      ctx.fillStyle = 'rgba(0, 200, 255, 0.18)';
      for (const [x, y] of getVisibleCells(grid, playerCell.x, playerCell.y, spellRange)) ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
    for (const f of fighters) {
      const x = f.cellId! % 100;
      const y = Math.floor(f.cellId! / 100);
      const color = f.team === 1 ? 'rgba(0,128,255' : 'rgba(255,64,64';
      ctx.fillStyle = `${color},0.25)`;
      ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = `${color},0.85)`;
      ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
    if (snapshot.selectedCellId != null) {
      const x = snapshot.selectedCellId % 100;
      const y = Math.floor(snapshot.selectedCellId / 100);
      ctx.fillStyle = 'rgba(255,255,0,0.35)';
      ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      if (playerCell) {
        const line = bresenhamLine(playerCell.x, playerCell.y, x, y);
        ctx.strokeStyle = 'rgba(255,255,0,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        line.forEach(([lx, ly], i) => i ? ctx.lineTo(lx * CELL_SIZE + CELL_SIZE / 2, ly * CELL_SIZE + CELL_SIZE / 2) : ctx.moveTo(lx * CELL_SIZE + CELL_SIZE / 2, ly * CELL_SIZE + CELL_SIZE / 2));
        ctx.stroke();
      }
    }
    if (harebourgMode && playerCell) {
      const enemy = fighters.find(f => f.team !== 1);
      if (enemy?.cellId != null) {
        const target = getHarebourgTargetCell(playerCell.x, playerCell.y, enemy.cellId % 100, Math.floor(enemy.cellId / 100), hpPercent, meleeHits);
        ctx.fillStyle = 'rgba(0,255,0,0.5)';
        ctx.fillRect(target.x * CELL_SIZE, target.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = 'rgba(0,255,0,0.95)';
        ctx.lineWidth = 4;
        ctx.strokeRect(target.x * CELL_SIZE, target.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }, [snapshot, playerCell, spellRange, harebourgMode, hpPercent, meleeHits]);

  useEffect(() => { draw(); }, [draw]);

  return <>
    <canvas ref={canvasRef} width={1920} height={1080} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', bottom: 10, left: 10, color: '#fff', background: 'rgba(0,0,0,.65)', padding: 8, borderRadius: 6, fontSize: 12, pointerEvents: 'auto' }}>
      <label><input type="checkbox" checked={harebourgMode} onChange={e => setHarebourgMode(e.target.checked)} /> Mode Harebourg</label>
      {harebourgMode ? <>
        <div>% PV <input type="number" min={0} max={100} value={hpPercent} onChange={e => setHpPercent(Number(e.target.value))} /></div>
        <div>Coups mêlée <input type="number" min={0} value={meleeHits} onChange={e => setMeleeHits(Number(e.target.value))} /></div>
      </> : <div>Portée <input type="number" min={1} max={20} value={spellRange} onChange={e => setSpellRange(Number(e.target.value))} /></div>}
    </div>
  </>;
}
