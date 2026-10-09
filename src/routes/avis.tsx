import { useEffect, useState, type PointerEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { travelFor, type WatchCoords, type WatchMonster } from "@/lib/pupitre/watch-settings";

export const Route = createFileRoute("/avis")({
  component: AvisPage,
});

type Card = WatchMonster;

function readPayload(): { cards: Card[]; coords: WatchCoords | null } {
  if (typeof window === "undefined") return { cards: [], coords: null };
  try {
    const raw = new URLSearchParams(window.location.search).get("m");
    if (!raw) return { cards: [], coords: null };
    const parsed = JSON.parse(raw) as { cards?: Card[]; coords?: WatchCoords | null };
    const cards = Array.isArray(parsed.cards)
      ? parsed.cards.filter((card) => card && typeof card.id === "number" && typeof card.name === "string").slice(0, 3)
      : [];
    return { cards, coords: parsed.coords ?? null };
  } catch {
    return { cards: [], coords: null };
  }
}

function AvisPage() {
  const [payload, setPayload] = useState(readPayload);
  const [cards, setCards] = useState<Card[]>([]);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.backgroundImage = "none";
    const initial = readPayload();
    setPayload(initial);
    setCards(initial.cards);
    const off = window.pupitre?.toast?.onCoords((coords) => {
      setPayload((current) => ({ ...current, coords }));
    });
    return () => off?.();
  }, []);

  useEffect(() => {
    window.pupitre?.toast?.setCount(cards.length);
  }, [cards.length]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    setOrigin({ x: event.screenX, y: event.screenY });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!origin) return;
    window.pupitre?.toast?.moveBy(event.screenX - origin.x, event.screenY - origin.y);
    setOrigin({ x: event.screenX, y: event.screenY });
  };
  const onPointerUp = () => {
    if (!origin) return;
    setOrigin(null);
    window.pupitre?.toast?.dragEnd();
  };

  if (cards.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      {cards.map((card) => (
        <ToastCard
          key={card.id}
          card={card}
          coords={payload.coords}
          onClose={() => setCards((list) => list.filter((entry) => entry.id !== card.id))}
        />
      ))}
    </div>
  );
}

function ToastCard({ card, coords, onClose }: { card: Card; coords: WatchCoords | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const command = travelFor(coords);
  const src = card.gfxId ? `https://api.dofusdb.fr/img/monsters/${card.gfxId}.png` : "";

  useEffect(() => {
    const timer = window.setTimeout(onClose, 10_000);
    return () => window.clearTimeout(timer);
  }, [card.id, onClose]);

  return (
    <article className="flex h-40 w-40 flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#161616]/95 shadow-lg">
      <div className="relative min-h-0 flex-1 bg-[#121212]">
        {src && !failed ? (
          <img src={src} alt="" className="h-full w-full object-contain" onError={() => setFailed(true)} />
        ) : (
          <div className="grid h-full place-items-center text-xs text-[#b2b2b2]">Portrait</div>
        )}
        <button
          type="button"
          aria-label="Fermer"
          className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/60 text-sm text-white"
          onClick={onClose}
        >
          ×
        </button>
        <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-[#b7dc69]">
          {card.kind === "archi" ? "Archi" : "Recherché"}
        </span>
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-xs text-white">{card.name}</p>
        {command ? (
          <button
            type="button"
            className="mt-1 text-[11px] text-[#b7dc69]"
            onClick={() => {
              void window.pupitre?.copyTravel?.(command);
              setCopied(true);
            }}
          >
            {copied ? "Copié" : command}
          </button>
        ) : coords && coords.world && coords.world !== 1 ? (
          <p className="mt-1 text-[11px] text-[#b2b2b2]">Autre monde</p>
        ) : (
          <p className="mt-1 text-[11px] text-[#b2b2b2]">Carte en cours</p>
        )}
      </div>
    </article>
  );
}
