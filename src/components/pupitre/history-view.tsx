import { FileSpreadsheet } from "lucide-react";
import { formatDuration, formatKamas } from "@/lib/pupitre/farm";
import { historyCsv, sessionRate, zoneStats } from "@/lib/pupitre/history";
import type { FarmHistoryEntry } from "@/lib/pupitre/store";

const RECENT = 20;

function download(entries: FarmHistoryEntry[]) {
  const blob = new Blob([historyCsv(entries)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pupitre-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function HistoryCharts({ entries }: { entries: FarmHistoryEntry[] }) {
  if (entries.length === 0) return null;
  const zones = zoneStats(entries);
  const best = Math.max(1, ...zones.map((zone) => Math.max(0, zone.rate)));
  const recent = entries.slice(0, RECENT).reverse();
  const rates = recent.map(sessionRate);
  const top = Math.max(1, ...rates.map((rate) => Math.abs(rate)));

  return (
    <section className="rounded-card border border-edge bg-moss p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-fog">Kamas par heure, par zone</h3>
          <p className="text-sm text-mist">
            {entries.length} session{entries.length > 1 ? "s" : ""} terminée{entries.length > 1 ? "s" : ""}. Total
            divisé par le temps passé dans la zone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => download(entries)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-edge bg-pine px-4 text-sm font-medium text-fog"
        >
          <FileSpreadsheet className="size-4" aria-hidden="true" />
          Exporter pour Excel
        </button>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {zones.map((zone) => (
          <li key={zone.zone} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="truncate text-fog" title={zone.zone}>
              {zone.zone}
            </span>
            <span className="h-3 overflow-hidden rounded-full bg-pine">
              <span
                className={"block h-full rounded-full " + (zone.rate < 0 ? "bg-clay" : "bg-lamp")}
                style={{ width: `${zone.rate <= 0 ? 2 : Math.max(2, (zone.rate / best) * 100)}%` }}
              />
            </span>
            <span className="text-right whitespace-nowrap">
              <span className={zone.rate < 0 ? "text-clay" : "text-lamp"}>{formatKamas(zone.rate)}/h</span>
              <span className="block text-xs text-mist">
                {zone.sessions} × · {formatDuration(zone.hours * 3_600_000)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {recent.length > 1 ? (
        <div className="mt-5">
          <p className="text-xs font-medium tracking-widest text-mist uppercase">
            {recent.length} dernières sessions, kamas/heure
          </p>
          <div className="mt-2 flex h-28 items-end gap-1 border-b border-edge" role="img" aria-label="Kamas par heure des dernières sessions">
            {recent.map((entry, index) => {
              const rate = rates[index] ?? 0;
              return (
                <div
                  key={entry.id}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end"
                  title={`${entry.zone} · ${new Date(entry.endedAt).toLocaleDateString("fr-FR")} · ${formatKamas(rate)}/h`}
                >
                  <div
                    className={"w-full rounded-t " + (rate < 0 ? "bg-clay" : "bg-lamp/80 hover:bg-lamp")}
                    style={{ height: `${Math.max(3, (Math.abs(rate) / top) * 100)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-xs text-mist">
            <span>{new Date(recent[0]!.endedAt).toLocaleDateString("fr-FR")}</span>
            <span>{new Date(recent.at(-1)!.endedAt).toLocaleDateString("fr-FR")}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
