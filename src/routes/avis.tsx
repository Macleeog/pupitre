import { createFileRoute } from "@tanstack/react-router";
import { cardsFromValue, coordsFromValue, WantedToast, type WantedCard } from "@/components/pupitre/wanted-toast";
import type { MapCoords } from "@/pupitre-desktop";

export const Route = createFileRoute("/avis")({
  validateSearch: (search: Record<string, unknown>): { cards: WantedCard[]; coords: MapCoords | null } => {
    const value = typeof search.m === "string" ? safeParse(search.m) : search.m;
    return { cards: cardsFromValue(value), coords: coordsFromValue(value) };
  },
  component: AvisRoute,
});

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function AvisRoute() {
  const { cards, coords } = Route.useSearch();
  return <WantedToast cards={cards} coords={coords} />;
}
