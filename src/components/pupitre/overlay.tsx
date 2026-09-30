import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { elapsedMs, formatDuration, snapshot } from "@/lib/pupitre/farm";
import { applyFarmCommand, bindFarmHotkeys, bindFarmSync } from "@/lib/pupitre/farm-sync";
import { overlayCapacity, overlayStat } from "@/lib/pupitre/overlay";
import { clampOverlayOpacity, usePupitre } from "@/lib/pupitre/store";

const STATUS = { idle: "Prête", running: "En cours", paused: "En pause", done: "Terminée" } as const;

export function Overlay() {
  const farm = usePupitre((state) => state.farm);
  const fields = usePupitre((state) => state.overlayFields);
  const size = usePupitre((state) => state.overlaySize);
  const buttons = usePupitre((state) => state.overlayButtons);
  const opacity = usePupitre((state) => state.overlayOpacity);
  const notices = usePupitre((state) => state.wantedNotices);
  const archiNotices = usePupitre((state) => state.archiNotices);
  const [sighting, setSighting] = useState<{ at: number; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useLayoutEffect(() => {
    // The shared page background is a gradient. This window is transparent so the game shows
    // through the card; only the card itself carries the chosen opacity.
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);

  useEffect(() => {
    void usePupitre.persist.rehydrate();
    const unbindSync = bindFarmSync();
    // Settings changed on the desk reach this window through shared storage, so its own saves
    // never write stale ones back. The farm is left out: it has its own channel.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "pupitre-dofus3" || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue).state ?? {};
        const current = usePupitre.getState();
        const fields = (value: unknown) => (Array.isArray(value) ? value.join() : "");
        const nextOpacity = clampOverlayOpacity(next.overlayOpacity);
        const sameFields =
          current.overlaySize === next.overlaySize &&
          current.overlayButtons === next.overlayButtons &&
          current.overlayOpacity === nextOpacity &&
          fields(current.overlayFields) === fields(next.overlayFields) &&
          current.wantedNotices === (next.wantedNotices !== false) &&
          current.archiNotices === (next.archiNotices !== false);
        if (sameFields) return;
        usePupitre.setState({
          overlayFields: next.overlayFields ?? current.overlayFields,
          overlaySize: next.overlaySize ?? current.overlaySize,
          overlayButtons: next.overlayButtons ?? current.overlayButtons,
          overlayOpacity: nextOpacity,
          wantedNotices: next.wantedNotices !== false,
          archiNotices: next.archiNotices !== false,
        });
      } catch {
        // A half-written value is replaced by the next write.
      }
    };
    window.addEventListener("storage", onStorage);
    const channel = new BroadcastChannel("pupitre-wanted");
    channel.onmessage = (event: MessageEvent<{ type?: string; at?: number; text?: string }>) => {
      const data = event.data;
      if (data?.type === "wanted-sighting" && data.at && data.text) setSighting({ at: data.at, text: data.text });
      if (data?.type === "wanted-absent") setSighting(null);
    };
    return () => {
      unbindSync();
      window.removeEventListener("storage", onStorage);
      channel.close();
    };
  }, []);

  useEffect(() => bindFarmHotkeys(), []);

  useEffect(() => {
    if (farm.status !== "running" && !sighting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [farm.status, sighting]);

  const alerts = notices !== false || archiNotices !== false;
  const wanted = alerts && sighting !== null && now - sighting.at < 10 * 60 * 1000;
  const elapsed = elapsedMs(farm, now);
  const totals = snapshot(farm, elapsed);
  const stats = fields.slice(0, overlayCapacity(size, buttons)).map((field) => overlayStat(field, farm, totals, elapsed));
  const large = size === "large";
  const dragHandlers = useWindowDrag();

  return (
    <div className="h-dvh text-fog">
      <section
        {...dragHandlers}
        style={{ backgroundColor: `rgba(26, 18, 12, ${opacity / 100})` }}
        className="flex h-full cursor-grab touch-none select-none flex-col justify-between border border-lamp/50 px-3 py-2 active:cursor-grabbing [text-shadow:0_1px_2px_rgb(0_0_0/0.65)] [&_button]:[text-shadow:none]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={"truncate font-medium " + (large ? "text-base" : "text-sm")}>{farm.zone.trim() || "Session"}</p>
            <p className={"truncate text-[11px] leading-tight " + (wanted ? "text-lamp" : "text-mist")}>
              {wanted ? sighting?.text : STATUS[farm.status]}
            </p>
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

// Pointer deltas in CSS pixels. screenX is physical pixels and runs too fast at 150% scaling.
// Buttons keep their own click; everything else moves the window. On release the main process
// gives the keyboard back to Dofus.
function useWindowDrag() {
  const drag = useRef({ x: 0, y: 0, active: false });

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: 0, y: 0, active: true };
    window.pupitre?.overlayDragStart?.();
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current.active) return;
    drag.current.x += event.movementX;
    drag.current.y += event.movementY;
    const dx = Math.trunc(drag.current.x);
    const dy = Math.trunc(drag.current.y);
    drag.current.x -= dx;
    drag.current.y -= dy;
    if (dx !== 0 || dy !== 0) window.pupitre?.overlayMoveBy?.(dx, dy);
  };

  const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
    const wasDragging = drag.current.active;
    drag.current = { x: 0, y: 0, active: false };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const onButton = (event.target as HTMLElement).closest("button");
    if (!wasDragging && !onButton) return;
    window.setTimeout(() => window.pupitre?.overlayDragEnd?.(), 0);
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
