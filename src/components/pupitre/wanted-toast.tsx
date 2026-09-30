import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import type { MapCoords, WantedKind } from "@/pupitre-desktop";

export type WantedCard = { id: number; name: string; gfxId?: number; kind?: WantedKind };

// The ochre Dofus, the sign of an archmonster hunt. Metamob hosts it; a miss just hides it.
const ARCHI_ICON = "https://www.metamob.fr/img/ocre.png";

export function ArchiIcon({ className = "size-4" }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={ARCHI_ICON} alt="Archimonstre" onError={() => setFailed(true)} className={className} />;
}

export function travelCommand(coords: MapCoords | null | undefined): string | null {
  if (!coords || !Number.isInteger(coords.x) || !Number.isInteger(coords.y)) return null;
  if (coords.x < -256 || coords.x > 256 || coords.y < -256 || coords.y > 256) return null;
  return `/travel ${coords.x},${coords.y}`;
}

export function parseWantedCards(payload: string): WantedCard[] {
  try {
    const parsed = JSON.parse(payload) as unknown;
    return cardsFromValue(parsed);
  } catch {
    return [];
  }
}

export function cardsFromValue(value: unknown): WantedCard[] {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { cards?: unknown }).cards)
      ? (value as { cards: unknown[] }).cards
      : [];
  const cards: WantedCard[] = [];
  for (const entry of list) {
    if (cards.length >= 3) break;
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { id?: unknown; name?: unknown; gfxId?: unknown; kind?: unknown };
    if (typeof row.id !== "number" || !Number.isFinite(row.id) || typeof row.name !== "string") continue;
    const name = row.name.trim().slice(0, 48);
    if (!name) continue;
    const card: WantedCard = { id: row.id, name };
    if (typeof row.gfxId === "number" && row.gfxId > 0) card.gfxId = row.gfxId;
    if (row.kind === "archi") card.kind = "archi";
    cards.push(card);
  }
  return cards;
}

export function coordsFromValue(value: unknown): MapCoords | null {
  const raw =
    value && typeof value === "object" && "coords" in value ? (value as { coords?: unknown }).coords : value;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { x?: unknown; y?: unknown };
  if (typeof row.x !== "number" || typeof row.y !== "number") return null;
  return travelCommand({ x: row.x, y: row.y }) ? { x: row.x, y: row.y } : null;
}

export function WantedToast({ cards, coords }: { cards: WantedCard[]; coords: MapCoords | null }) {
  const [live, setLive] = useState(coords);
  useLayoutEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
  }, []);
  useEffect(() => {
    return window.pupitre?.toast?.onCoords?.((next) => setLive(coordsFromValue(next)));
  }, []);

  return <WantedSquares monsters={cards} coords={live} />;
}

export function WantedSquares({ monsters, coords = null }: { monsters: WantedCard[]; coords?: MapCoords | null }) {
  const [cards, setCards] = useState(monsters);
  const dismiss = useCallback((id: number) => {
    setCards((list) => list.filter((card) => card.id !== id));
  }, []);
  const drag = useToastDrag();

  useEffect(() => {
    window.pupitre?.toast?.setCount(cards.length);
  }, [cards.length]);

  if (cards.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" {...drag}>
      {cards.map((card) => (
        <WantedSquare key={card.id} card={card} coords={coords} onClose={dismiss} />
      ))}
    </div>
  );
}

function WantedSquare({
  card,
  coords,
  onClose,
}: {
  card: WantedCard;
  coords: MapCoords | null;
  onClose: (id: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => onClose(card.id), 10_000);
    return () => window.clearTimeout(timer);
  }, [card.id, onClose]);

  const src = card.gfxId ? `https://api.dofusdb.fr/img/monsters/${card.gfxId}.png` : "";
  const command = travelCommand(coords);
  const archi = card.kind === "archi";

  return (
    <article
      className={
        "relative flex h-[168px] w-[148px] shrink-0 cursor-grab flex-col overflow-hidden rounded-xl bg-pine active:cursor-grabbing " +
        (archi
          ? "border-2 border-lamp shadow-[0_0_0_1px_var(--color-lamp),0_0_18px_2px_rgb(224_163_58/0.55)]"
          : "border border-lamp/80")
      }
    >
      <div className="relative min-h-0 flex-1">
        {archi ? (
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_100%,rgb(224_163_58/0.3),transparent_70%)]" />
        ) : null}
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
        <div className="pointer-events-none absolute top-1.5 right-1.5 left-9">
          <p
            className={
              "line-clamp-2 text-right text-[11px] leading-tight font-medium [text-shadow:0_1px_2px_rgb(0_0_0/0.9)] " +
              (archi ? "text-lamp" : "text-fog")
            }
          >
            {archi ? <ArchiIcon className="mr-1 inline-block size-4 align-text-bottom" /> : null}
            {card.name}
          </p>
        </div>
      </div>
      {command && coords ? (
        <button
          type="button"
          onClick={() => {
            window.pupitre?.toast?.copy?.(command);
            void navigator.clipboard?.writeText(command).then(
              () => setCopied(true),
              () => setCopied(true),
            );
          }}
          className="shrink-0 bg-pine/90 px-1.5 py-1 text-center leading-tight"
        >
          <span className="block text-[10px] text-mist">
            {coords.x},{coords.y}
          </span>
          <span className="block text-[11px] font-medium text-fog">{copied ? "Copié" : command}</span>
        </button>
      ) : (
        <div className="h-8 shrink-0" />
      )}
    </article>
  );
}

function useToastDrag() {
  const drag = useRef({ x: 0, y: 0, active: false });

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: 0, y: 0, active: true };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current.active) return;
    drag.current.x += event.movementX;
    drag.current.y += event.movementY;
    const dx = Math.trunc(drag.current.x);
    const dy = Math.trunc(drag.current.y);
    drag.current.x -= dx;
    drag.current.y -= dy;
    if (dx !== 0 || dy !== 0) window.pupitre?.toast?.moveBy?.(dx, dy);
  };

  const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
    const wasDragging = drag.current.active;
    drag.current = { x: 0, y: 0, active: false };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (wasDragging) window.pupitre?.toast?.dragEnd?.();
  };

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
}
