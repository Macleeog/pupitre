import test from "node:test";
import assert from "node:assert/strict";
import { historyCsv, sessionRate, zoneStats } from "./history.ts";
import type { FarmHistoryEntry } from "./store.ts";

const HOUR = 3_600_000;

function entry(zone: string, hours: number, total: number, notes = ""): FarmHistoryEntry {
  return {
    id: `${zone}-${hours}`,
    zone,
    notes,
    startedAt: Date.UTC(2026, 8, 29, 10, 0),
    endedAt: Date.UTC(2026, 8, 29, 12, 0),
    combats: 10,
    donjons: 0,
    elapsedMs: hours * HOUR,
    kamas: 30,
    gross: total,
    keys: 0,
    other: 0,
    jackpot: 0,
    normal: total,
    total,
  };
}

test("kamas par heure d'une session", () => {
  assert.equal(sessionRate(entry("Klime", 2, 100_000)), 50_000);
  assert.equal(sessionRate(entry("Klime", 0, 100_000)), 0);
});

test("par zone : total sur temps total, meilleure zone en premier", () => {
  const stats = zoneStats([entry("Klime", 1, 10_000), entry("Piou", 1, 40_000), entry("Klime", 3, 90_000)]);
  assert.deepEqual(
    stats.map((zone) => [zone.zone, zone.sessions, zone.rate]),
    [
      ["Piou", 1, 40_000],
      ["Klime", 2, 25_000],
    ],
  );
});

test("export Excel : BOM, points-virgules, texte protégé", () => {
  const csv = historyCsv([entry("Salle; des \"Pious\"", 1, 5000, "=HYPERLINK(1)")]);
  assert.ok(csv.startsWith("\uFEFFFin;Début;Zone;"));
  const [, row] = csv.trim().split("\r\n");
  assert.ok(row.includes('"Salle; des ""Pious"""'));
  assert.ok(row.endsWith(";'=HYPERLINK(1)"));
  assert.ok(row.includes(";5000;5000;"));
});
