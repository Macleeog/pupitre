import type { FarmHistoryEntry } from "@/lib/pupitre/store";

export type ZoneStat = { zone: string; sessions: number; hours: number; total: number; rate: number };

export function sessionRate(entry: FarmHistoryEntry): number {
  const hours = entry.elapsedMs / 3_600_000;
  return hours > 0 ? entry.total / hours : 0;
}

// Rate per zone is total kamas over total time, so long sessions weigh more than short ones.
export function zoneStats(entries: FarmHistoryEntry[]): ZoneStat[] {
  const zones = new Map<string, ZoneStat>();
  for (const entry of entries) {
    const key = entry.zone.trim() || "Sans zone";
    const zone = zones.get(key) ?? { zone: key, sessions: 0, hours: 0, total: 0, rate: 0 };
    zone.sessions += 1;
    zone.hours += entry.elapsedMs / 3_600_000;
    zone.total += entry.total;
    zones.set(key, zone);
  }
  return [...zones.values()]
    .map((zone) => ({ ...zone, rate: zone.hours > 0 ? zone.total / zone.hours : 0 }))
    .sort((a, b) => b.rate - a.rate);
}

const COLUMNS: { label: string; value: (entry: FarmHistoryEntry) => string | number }[] = [
  { label: "Fin", value: (entry) => localDateTime(entry.endedAt) },
  { label: "Début", value: (entry) => (entry.startedAt ? localDateTime(entry.startedAt) : "") },
  { label: "Zone", value: (entry) => entry.zone },
  { label: "Durée (min)", value: (entry) => Math.round(entry.elapsedMs / 60_000) },
  { label: "Combats", value: (entry) => entry.combats },
  { label: "Donjons", value: (entry) => entry.donjons },
  { label: "Kamas des combats", value: (entry) => entry.kamas ?? 0 },
  { label: "Valeur brute", value: (entry) => entry.gross },
  { label: "Clefs", value: (entry) => entry.keys },
  { label: "Autres dépenses", value: (entry) => entry.other },
  { label: "Jackpot", value: (entry) => entry.jackpot },
  { label: "Total", value: (entry) => entry.total },
  { label: "Kamas / heure", value: (entry) => Math.round(sessionRate(entry)) },
  { label: "Notes", value: (entry) => entry.notes },
];

function localDateTime(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function cell(value: string | number): string {
  const text = String(value);
  // A leading = + - @ would run as a formula when Excel opens the file.
  const safe = /^[=+\-@]/.test(text) && typeof value === "string" ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// French Excel opens a UTF-8 file with a BOM and semicolons directly, accents included.
export function historyCsv(entries: FarmHistoryEntry[]): string {
  const rows = [COLUMNS.map((column) => column.label), ...entries.map((entry) => COLUMNS.map((column) => column.value(entry)))];
  return "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n") + "\r\n";
}
