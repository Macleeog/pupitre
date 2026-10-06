import { useEffect, useRef, useState } from 'react';
import type { CombatSnapshot, FighterState } from '../lib/pupitre/combat-bridge';

const CELL_SIZE = 40;

export default function Overlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snapshot, setSnapshot] = useState<CombatSnapshot | null>(null);

  useEffect(() => {
    if (!window.pupitre) return;
    const unsub = window.pupitre.onCombatUpdate((s) => {
      setSnapshot(s);
      window.pupitre.sendCombatSnapshot(s);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !snapshot) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    const fighters = snapshot.fighters.filter(f => f.cellId != null);

    for (const f of fighters) {
      const x = (f.cellId! % 100) * CELL_SIZE;
      const y = Math.floor(f.cellId! / 100) * CELL_SIZE;

      ctx.fillStyle = f.team === 1 ? 'rgba(0, 128, 255, 0.25)' : 'rgba(255, 64, 64, 0.25)';
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

      ctx.strokeStyle = f.team === 1 ? 'rgba(0, 128, 255, 0.8)' : 'rgba(255, 64, 64, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
    }

    if (snapshot.selectedCellId != null) {
      const sx = (snapshot.selectedCellId % 100) * CELL_SIZE;
      const sy = Math.floor(snapshot.selectedCellId / 100) * CELL_SIZE;
      ctx.fillStyle = 'rgba(255, 255, 0, 0.35)';
      ctx.fillRect(sx, sy, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
      ctx.lineWidth = 3;
      ctx.strokeRect(sx, sy, CELL_SIZE, CELL_SIZE);
    }
  }, [snapshot]);

  return (
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
  );
}
