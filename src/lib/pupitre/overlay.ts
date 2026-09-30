import { formatKamas, parseKamas, perHour, type FarmSession, type FarmSnapshot } from "@/lib/pupitre/farm";
import type { OverlayField } from "@/lib/pupitre/store";
import type { OverlaySize } from "@/pupitre-desktop";

// How many stats fit under the chrono, three per row, for each fixed bandeau size.
export function overlayCapacity(size: OverlaySize, buttons: boolean): number {
  if (size === "large") return 6;
  return buttons ? 3 : 6;
}

export function overlayStat(
  field: OverlayField,
  farm: FarmSession,
  totals: FarmSnapshot,
  elapsed: number,
): { label: string; value: string } {
  switch (field) {
    case "rate":
      return { label: "K / h", value: formatKamas(perHour(totals.normal, elapsed)) };
    case "gross":
      return { label: "Gagné", value: formatKamas(totals.gross) };
    case "kamas":
      return { label: "Kamas", value: formatKamas(totals.kamas) };
    case "items":
      return {
        label: "Objets",
        value: String(farm.resources.reduce((sum, resource) => sum + parseKamas(resource.qty), 0)),
      };
    case "combats":
      return { label: "Combats", value: String(farm.combats) };
    case "donjons":
      return { label: "Donjons", value: String(farm.donjons) };
  }
}
