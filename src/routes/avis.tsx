import { createFileRoute } from "@tanstack/react-router";
import { parseWantedCards, WantedToast, type WantedCard } from "@/components/pupitre/wanted-toast";

export const Route = createFileRoute("/avis")({
  validateSearch: (search: Record<string, unknown>) => ({
    m: cardsFromSearch(search.m),
  }),
  component: AvisRoute,
});

function cardsFromSearch(value: unknown): WantedCard[] {
  if (Array.isArray(value)) return parseWantedCards(JSON.stringify(value));
  if (typeof value === "string") return parseWantedCards(value);
  return [];
}

function AvisRoute() {
  const { m } = Route.useSearch();
  return <WantedToast cards={m} />;
}
