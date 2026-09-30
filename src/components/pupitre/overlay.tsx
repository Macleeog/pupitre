import { useEffect, useRef, useState, type PointerEvent } from "react";
import { elapsedMs, formatDuration, snapshot } from "@/lib/pupitre/farm";
import { applyFarmCommand, bindFarmHotkeys, bindFarmSync } from "@/lib/pupitre/farm-sync";
import { overlayCapacity, overlayStat } from "@/lib/pupitre/overlay";
import { usePupitre } from "@/lib/pupitre/store";

const STATUS = { idle: "Prête", running: "En cours", paused: "En pause", done: "Terminée" } as const;

export function Overlay() {
  const farm = usePupitre((state) => state.farm);
  const fields = usePupitre((state) => state.overlayFields);
  const size = usePupitre((state) => state.overlaySize);
  const buttons = usePupitre((state) => state.overlayButtons);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void usePupitre.persist.rehydrate();
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    const unbindSync = bindFarmSync();
    // Settings changed on the desk reach this window through shared storage, so its own saves
    // never write stale ones back. The farm is left out: it has its own channel.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "pupitre-dofus3" || !event.newValue) return;
      try {
        const { farm: _farm, farmHistory: _history, ...settings } = JSON.parse(event.newValue).state ?? {};
        usePupitre.setState(settings);
      } catch {
        // A half-written value is replaced by the next write.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unbindSync();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => bindFarmHotkeys(), []);

  useEffect(() => {
    if (farm.status !== "running") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [farm.status]);

  const elapsed = elapsedMs(farm, now);
  const totals = snapshot(farm, elapsed);
  const stats = fields.slice(0, overlayCapacity(size, buttons)).map((field) => overlayStat(field, farm, totals, elapsed));
  const large = size === "large";
  const dragHandlers = useWindowDrag();

  return (
    <div className="h-dvh bg-transparent p-1 text-fog">
      <section
        {...dragHandlers}
        className="flex h-full cursor-grab touch-none select-none active:cursor-grabbing flex-col justify-between rounded-2xl border border-lamp/50 bg-pine/95 px-3 py-2 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={"truncate font-medium " + (large ? "text-base" : "text-sm")}>{farm.zone.trim() || "Session"}</p>
            <p className="text-[11px] leading-tight text-mist">{STATUS[farm.status]}</p>
          </div>
          <p className={"font-display leading-none " + (large ? "text-3xl" : "text-2xl")}>{formatDuration(elapsed)}</p>
        </div>
        {stats.length > 0 ? (
          <dl className="grid grid-cols-3 gap-x-2 gap-y-1">
            {stats.map((stat) => (
              <div key={stat.label} className="min-w-0">
                <dt className="text-[10px] leading-tight tracking-wide text-mist uppercase">{stat.label}</dt>
                <dd className={"truncate font-medium leading-tight " + (large ? "text-base" : "text-sm")}>{stat.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {buttons ? (
          <div className="grid grid-cols-4 gap-1">
            <HudButton label="Start" onClick={() => applyFarmCommand("start")} />
            <HudButton label="Pause" onClick={() => applyFarmCommand("pause")} />
            <HudButton label="Stop" onClick={() => applyFarmCommand("stop")} />
            <HudButton label="+1" onClick={() => applyFarmCommand("combat")} />
          </div>
        ) : null}
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
