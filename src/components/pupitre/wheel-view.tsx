import { useRef, useState, type PointerEvent } from "react";
import { classById } from "@/lib/pupitre/classes";
import { usePupitre } from "@/lib/pupitre/store";
import { Sigil } from "@/components/pupitre/sigil";

export function WheelView() {
  const characters = usePupitre((state) => state.characters);
  const focusId = usePupitre((state) => state.focusId);
  const setFocus = usePupitre((state) => state.setFocus);
  const restoreExample = usePupitre((state) => state.restoreExample);
  const svgRef = useRef<SVGSVGElement>(null);
  const [aim, setAim] = useState<number | null>(null);
  const [holding, setHolding] = useState(false);

  if (characters.length === 0) {
    return (
      <section className="rounded-card bg-paper px-5 py-8 text-ink">
        <h2 className="font-display text-4xl leading-none">Roue vide</h2>
        <p className="mt-3 text-sm text-ink/70">Ajoute des personnages dans Tour, ou charge l'exemple.</p>
        <button
          type="button"
          onClick={restoreExample}
          className="mt-4 min-h-11 rounded-full bg-ink px-4 text-sm font-medium text-paper"
        >
          Charger l'exemple
        </button>
      </section>
    );
  }

  const count = characters.length;
  const aimed = aim === null ? null : characters[aim];
  const shown = aimed ?? characters.find((character) => character.id === focusId) ?? characters[0];

  const pickFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    let angle = Math.atan2(y, x) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    return Math.min(count - 1, Math.floor((angle / (Math.PI * 2)) * count));
  };

  return (
    <section className="flex flex-col items-center">
      <p className="mb-4 max-w-sm text-center text-sm text-mist">
        Tiens le centre, vise une classe, relâche. Même geste que la roue Rétro, pour les 19 classes de Dofus 3.
      </p>
      <svg
        ref={svgRef}
        viewBox="0 0 240 240"
        className="w-full max-w-sm touch-none select-none"
        role="listbox"
        aria-label="Roue des personnages"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setHolding(true);
          setAim(pickFromPointer(event));
        }}
        onPointerMove={(event) => {
          if (!holding) return;
          setAim(pickFromPointer(event));
        }}
        onPointerUp={(event) => {
          const index = pickFromPointer(event);
          const character = characters[index];
          if (character) setFocus(character.id);
          setHolding(false);
          setAim(null);
        }}
        onPointerCancel={() => {
          setHolding(false);
          setAim(null);
        }}
      >
        {characters.map((character, index) => {
          const active = character.id === (aimed?.id ?? focusId);
          return (
            <path
              key={character.id}
              d={wedgePath(index, count)}
              fill={active ? "var(--color-lamp)" : "var(--color-canopy)"}
              stroke="var(--color-pine)"
              strokeWidth="2"
            />
          );
        })}
        {characters.map((character, index) => {
          const [x, y] = labelPoint(index, count);
          const active = character.id === (aimed?.id ?? focusId);
          return (
            <text
              key={`${character.id}-label`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={active ? "var(--color-lamp-ink)" : "var(--color-fog)"}
              fontSize={count > 8 ? 10 : 13}
              fontFamily="Outfit, sans-serif"
              pointerEvents="none"
            >
              {character.name}
            </text>
          );
        })}
        <circle cx="120" cy="120" r="38" fill="var(--color-paper)" />
      </svg>
      {shown ? (
        <div className="mt-2 text-center">
          <p className="font-display text-3xl text-fog">{shown.name}</p>
          <p className="text-sm text-mist">
            {classById(shown.classId).name}
            {holding ? " · relâche pour le mettre devant" : " · au premier plan"}
          </p>
        </div>
      ) : null}
      <ul className="mt-4 grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
        {characters.map((character) => {
          const active = character.id === focusId;
          return (
            <li key={character.id}>
              <button
                type="button"
                onClick={() => setFocus(character.id)}
                className={
                  "flex min-h-12 w-full items-center gap-2 rounded-2xl border px-3 text-left " +
                  (active ? "border-lamp bg-lamp text-lamp-ink" : "border-edge bg-moss")
                }
              >
                <Sigil id={character.classId} className="size-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{character.name}</span>
                  <span className={"block text-xs " + (active ? "text-lamp-ink/70" : "text-mist")}>
                    {classById(character.classId).name}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function wedgePath(index: number, count: number): string {
  if (count === 1) {
    return "M120 18 a102 102 0 1 1 0.1 0 Z M120 82 a38 38 0 1 0 -0.1 0 Z";
  }
  const start = (index / count) * Math.PI * 2 - Math.PI / 2;
  const end = ((index + 1) / count) * Math.PI * 2 - Math.PI / 2;
  const large = end - start > Math.PI ? 1 : 0;
  const outer = 102;
  const inner = 46;
  const point = (angle: number, radius: number) => [
    120 + radius * Math.cos(angle),
    120 + radius * Math.sin(angle),
  ];
  const [x0, y0] = point(start, outer);
  const [x1, y1] = point(end, outer);
  const [x2, y2] = point(end, inner);
  const [x3, y3] = point(start, inner);
  return `M ${x0} ${y0} A ${outer} ${outer} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${inner} ${inner} 0 ${large} 0 ${x3} ${y3} Z`;
}

function labelPoint(index: number, count: number): [number, number] {
  const mid = ((index + 0.5) / count) * Math.PI * 2 - Math.PI / 2;
  const radius = count === 1 ? 78 : 74;
  return [120 + radius * Math.cos(mid), 120 + radius * Math.sin(mid)];
}
