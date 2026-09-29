export type FarmStatus = "idle" | "running" | "paused" | "done";

export type FarmResource = {
  id: string;
  name: string;
  qty: string;
  price: string;
  itemId: number | null;
  icon: string;
  typeName: string;
  level: number | null;
};

export type FarmSession = {
  status: FarmStatus;
  zone: string;
  notes: string;
  startedAt: number | null;
  segmentStartedAt: number | null;
  accumulatedMs: number;
  combats: number;
  donjons: number;
  resources: FarmResource[];
  keys: string;
  other: string;
  jackpot: string;
};

export type FarmSnapshot = {
  elapsedMs: number;
  gross: number;
  keys: number;
  other: number;
  jackpot: number;
  normal: number;
  total: number;
};

export const EMPTY_FARM: FarmSession = {
  status: "idle",
  zone: "",
  notes: "",
  startedAt: null,
  segmentStartedAt: null,
  accumulatedMs: 0,
  combats: 0,
  donjons: 0,
  resources: [],
  keys: "",
  other: "",
  jackpot: "",
};

export function parseKamas(value: string): number {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function elapsedMs(session: FarmSession, now: number): number {
  if (session.status === "running" && session.segmentStartedAt !== null) {
    return session.accumulatedMs + Math.max(0, now - session.segmentStartedAt);
  }
  return session.accumulatedMs;
}

export function snapshot(session: FarmSession, elapsed: number): FarmSnapshot {
  const gross = session.resources.reduce(
    (sum, resource) => sum + parseKamas(resource.qty) * parseKamas(resource.price),
    0,
  );
  const keys = parseKamas(session.keys);
  const other = parseKamas(session.other);
  const jackpot = parseKamas(session.jackpot);
  const normal = gross - keys - other;
  return { elapsedMs: elapsed, gross, keys, other, jackpot, normal, total: normal + jackpot };
}

export function perHour(count: number, elapsed: number): number {
  if (elapsed < 1000) return 0;
  return count / (elapsed / 3_600_000);
}

export function averageMs(elapsed: number, count: number): number {
  if (count <= 0) return 0;
  return elapsed / count;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatKamas(value: number): string {
  const rounded = Math.round(value);
  const formatted = new Intl.NumberFormat("fr-FR").format(Math.abs(rounded));
  return `${rounded < 0 ? "-" : ""}${formatted} K`;
}

export function formatDecimal(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").slice(0, 12);
}
