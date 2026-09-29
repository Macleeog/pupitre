import { useEffect, useRef, useState, type PointerEvent } from "react";
import { elapsedMs, formatDuration, formatKamas, perHour, snapshot } from "@/lib/pupitre/farm";
import { applyFarmCommand, bindFarmHotkeys, bindFarmSync } from "@/lib/pupitre/farm-sync";
import { usePupitre } from "@/lib/pupitre/store";

export function Overlay() {
  const farm = usePupitre((state) => state.farm);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void usePupitre.persist.rehydrate();
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return bindFarmSync();
  }, []);

  useEffect(() => bindFarmHotkeys(), []);

  useEffect(() => {
    if (farm.status !== "running") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [farm.status]);

  const elapsed = elapsedMs(farm, now);
  const totals = snapshot(farm, elapsed);
  const rate = perHour(totals.normal, elapsed);
  const dragHandlers = useWindowDrag();

  return (
    <div className="h-dvh bg-transparent p-1 text-fog">
      <section
        {...dragHandlers}
        className="flex h-full cursor-grab touch-none select-none active:cursor-grabbing flex-col justify-between rounded-2xl border border-lamp/50 bg-pine/95 px-3 py-2 shadow-lg">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-medium">{farm.zone.trim() || "Session"}</p>
          <p className="font-display text-2xl leading-none">{formatDuration(elapsed)}</p>
        </div>
        <p className="text-xs text-mist">
          {farm.status === "running"
            ? `${formatKamas(rate)} / h`
            : farm.status === "paused"
              ? "En pause"
              : farm.status === "done"
                ? "Terminée"
                : "Prête"}
          {" · "}
          {farm.combats} combats
        </p>
        <div className="grid grid-cols-4 gap-1">
          <HudButton label="Start" onClick={() => applyFarmCommand("start")} />
          <HudButton label="Pause" onClick={() => applyFarmCommand("pause")} />
          <HudButton label="Stop" onClick={() => applyFarmCommand("stop")} />
          <HudButton label="+1" onClick={() => applyFarmCommand("combat")} />
        </div>
      </section>
    </div>
  );
}

// The overlay window never takes focus (so Dofus keeps the keyboard), which rules out
// -webkit-app-region dragging; the main process moves the window from pointer deltas instead.
function useWindowDrag() {
  const last = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    last.current = { x: event.screenX, y: event.screenY };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!last.current) return;
    const dx = event.screenX - last.current.x;
    const dy = event.screenY - last.current.y;
    if (dx === 0 && dy === 0) return;
    last.current = { x: event.screenX, y: event.screenY };
    window.pupitre?.overlayMoveBy?.(dx, dy);
  };

  const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
    if (!last.current) return;
    last.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.pupitre?.overlayDragEnd?.();
  };

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
}

function HudButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer min-h-9 rounded-lg border border-edge bg-moss text-xs font-medium"
    >
      {label}
    </button>
  );
}
