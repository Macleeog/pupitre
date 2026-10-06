import { useEffect, useRef, useState, useCallback } from 'react';
import type { CombatSnapshot, FighterState } from '../lib/pupitre/combat-bridge';
import { getVisibleCells, bresenhamLine, type Grid } from '../lib/pupitre/line-of-sight';
import { getHarebourgTargetCell } from '../lib/pupitre/harebourg';

const CELL_SIZE = 40;
const GRID_COLS = 50;
const GRID_ROWS = 30;

function buildGridFromFighters(fighters: FighterState[]): Grid {
  const grid: Grid = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < GRID_COLS; x++) {
      row.push({ x, y, walkable: true });
    }
    grid.push(row);
  }
  for (const f of fighters) {
    if (f.cellId == null) continue;
    const x = f.cellId % 100;
    const y = Math.floor(f.cellId / 100);
    if (y >= 0 && y < GRID_ROWS && x >= 0 && x < GRID_COLS) {
      grid[y][x].walkable = false;
    }
  }
  return grid;
}

export default function Overlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snapshot, setSnapshot] = useState<CombatSnapshot | null>(null);
  const [playerCell, setPlayerCell] = useState<{ x: number; y: number } | null>(null);
  const [spellRange, setSpellRange] = useState<number>(6);
  const [harebourgMode, setHarebourgMode] = useState<boolean>(false);
  const [hpPercent, setHpPercent] = useState<number>(80);
  const [meleeHits, setMeleeHits] = useState<number>(0);

  useEffect(() => {
    if (!window.pupitre) return;
    const unsub = window.pupitre.onCombatUpdate((s) => {
      setSnapshot(s);
      window.pupitre.sendCombatSnapshot(s);
      if (s.fighters.length > 0) {
        const first = s.fighters[0];
        if (first.cellId != null) {
          setPlayerCell({ x: first.cellId % 100, y: Math.floor(first.cellId / 100) });
        }
      }
    });
    return unsub;
  }, []);

  const drawOverlay = useCallback(() => {
    if (!canvasRef.current || !snapshot) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    const fighters = snapshot.fighters.filter(f => f.cellId != null);
    const grid = buildGridFromFighters(fighters);

    if (playerCell && !harebourgMode) {
      const visible = getVisibleCells(grid, playerCell.x, playerCell.y, spellRange);
      ctx.fillStyle = 'rgba(0, 200, 255, 0.18)';
      for (const [x, y] of visible) {
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    for (const f of fighters) {
      const x = f.cellId! % 100;
      const y = Math.floor(f.cellId! / 100);
      ctx.fillStyle = f.team === 1 ? 'rgba(0, 128, 255, 0.25)' : 'rgba(255, 64, 64, 0.25)';
      ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = f.team === 1 ? 'rgba(0, 128, 255, 0.8)' : 'rgba(255, 64, 64, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }

    if (snapshot.selectedCellId != null && playerCell) {
      const sx = snapshot.selectedCellId % 100;
      const sy = Math.floor(snapshot.selectedCellId / 100);
      if (playerCell) {
        const line = bresenhamLine(playerCell.x, playerCell.y, sx, sy);
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const [x0, y0] = line[0];
        ctx.moveTo(x0 * CELL_SIZE + CELL_SIZE / 2, y0 * CELL_SIZE + CELL_SIZE / 2);
        for (const [x, y] of line.slice(1)) {
          ctx.lineTo(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255, 255, 0, 0.35)';
      ctx.fillRect(sx * CELL_SIZE, sy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
      ctx.lineWidth = 3;
      ctx.strokeRect(sx * CELL_SIZE, sy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }

    if (harebourgMode && playerCell && snapshot.fighters.length > 1) {
      const target = snapshot.fighters[1];
      if (target.cellId != null) {
        const tx = target.cellId % 100;
        const ty = Math.floor(target.cellId / 100);
        const harebourgTarget = getHarebourgTargetCell(playerCell.x, playerCell.y, tx, ty, hpPercent, meleeHits);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.fillRect(harebourgTarget.x * CELL_SIZE, harebourgTarget.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.95)';
        ctx.lineWidth = 4;
        ctx.strokeRect(harebourgTarget.x * CELL_SIZE, harebourgTarget.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }, [snapshot, playerCell, spellRange, harebourgMode, hpPercent, meleeHits]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 6, color: '#fff', fontSize: 12 }}>
        <div>
          <label>
            <input type="checkbox" checked={harebourgMode} onChange={e => setHarebourgMode(e.target.checked)} />
            {' '}Mode Harebourg
          </label>
        </div>
        {harebourgMode && (
          <>
            <div>
              <label>
                % PV: {' '}
                <input type="number" min={0} max={100} value={hpPercent} onChange={e => setHpPercent(Number(e.target.value))} style={{ width: 50 }} />
              </label>
            </div>
            <div>
              <label>
                Coups mêlée: {' '}
                <input type="number" min={0} value={meleeHits} onChange={e => setMeleeHits(Number(e.target.value))} style={{ width: 40 }} />
              </label>
            </div>
          </>
        )}
        {!harebourgMode && (
          <div>
            <label>
              Portée sort: {' '}
              <input type="number" min={1} max={20} value={spellRange} onChange={e => setSpellRange(Number(e.target.value))} style={{ width: 40 }} />
            </label>
          </div>
        )}
      </div>
    </>
  );
}
