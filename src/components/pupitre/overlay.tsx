import { useEffect, useState } from "react";
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

  return (
    <div className="h-dvh bg-transparent p-1 text-fog">
      <section className="[-webkit-app-region:drag] flex h-full flex-col justify-between rounded-2xl border border-lamp/50 bg-pine/95 px-3 py-2 shadow-lg">
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

function HudButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="[-webkit-app-region:no-drag] min-h-9 rounded-lg border border-edge bg-moss text-xs font-medium"
    >
      {label}
    </button>
  );
}
