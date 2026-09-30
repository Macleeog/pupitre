import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export type WantedCard = { id: number; name: string; gfxId?: number };

export function parseWantedCards(payload: string): WantedCard[] {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!Array.isArray(parsed)) return [];
    const cards: WantedCard[] = [];
    for (const entry of parsed) {
      if (cards.length >= 3) break;
      if (!entry || typeof entry !== "object") continue;
      const row = entry as { id?: unknown; name?: unknown; gfxId?: unknown };
      if (typeof row.id !== "number" || !Number.isFinite(row.id) || typeof row.name !== "string") continue;
      const name = row.name.trim().slice(0, 48);
      if (!name) continue;
      const card: WantedCard = { id: row.id, name };
      if (typeof row.gfxId === "number" && row.gfxId > 0) card.gfxId = row.gfxId;
      cards.push(card);
    }
    return cards;
  } catch {
    return [];
  }
}

export function WantedToast({ cards }: { cards: WantedCard[] }) {
  useLayoutEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
  }, []);

  return <WantedSquares monsters={cards} />;
}

export function WantedSquares({ monsters }: { monsters: WantedCard[] }) {
  const [cards, setCards] = useState(monsters);
  const dismiss = useCallback((id: number) => {
    setCards((list) => list.filter((card) => card.id !== id));
  }, []);

  useEffect(() => {
    window.pupitre?.toast?.setCount(cards.length);
  }, [cards.length]);

  if (cards.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {cards.map((card) => (
        <WantedSquare key={card.id} card={card} onClose={dismiss} />
      ))}
    </div>
  );
}

function WantedSquare({ card, onClose }: { card: WantedCard; onClose: (id: number) => void }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => onClose(card.id), 10_000);
    return () => window.clearTimeout(timer);
  }, [card.id, onClose]);

  const src = card.gfxId ? `https://api.dofusdb.fr/img/monsters/${card.gfxId}.png` : "";

  return (
    <article className="relative size-[128px] shrink-0 overflow-hidden rounded-xl border border-lamp/80 bg-pine">
      {src && !failed ? (
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-contain object-bottom pt-7"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-display text-4xl text-lamp">
          {card.name.slice(0, 1)}
        </span>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-pine/90 to-transparent" />
      <button
        type="button"
        aria-label="Fermer"
        onClick={() => onClose(card.id)}
        className="absolute top-1 left-1 flex size-7 items-center justify-center rounded-full bg-pine/80 text-fog"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>
      <p className="absolute top-1.5 right-1.5 left-9 line-clamp-2 text-right text-[11px] leading-tight font-medium text-fog [text-shadow:0_1px_2px_rgb(0_0_0/0.9)]">
        {card.name}
      </p>
    </article>
  );
}
