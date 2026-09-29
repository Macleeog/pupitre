import { useMemo } from "react";
import {
  FAMILY_LABEL,
  FAMILY_ORDER,
  formatWeight,
  gradeOf,
  runesFor,
  type RuneGrade,
  type RuneStat,
} from "@/lib/pupitre/runes";
import { usePupitre } from "@/lib/pupitre/store";

const GRADES: { id: RuneGrade; label: string }[] = [
  { id: "rune", label: "Rune" },
  { id: "pa", label: "Pa" },
  { id: "ra", label: "Ra" },
];

export function RunesView() {
  const edition = usePupitre((state) => state.edition);
  const setEdition = usePupitre((state) => state.setEdition);
  const family = usePupitre((state) => state.family);
  const setFamily = usePupitre((state) => state.setFamily);
  const query = usePupitre((state) => state.query);
  const setQuery = usePupitre((state) => state.setQuery);
  const handId = usePupitre((state) => state.handId);
  const grade = usePupitre((state) => state.grade);
  const setHand = usePupitre((state) => state.setHand);
  const setGrade = usePupitre((state) => state.setGrade);
  const sink = usePupitre((state) => state.sink);
  const setSink = usePupitre((state) => state.setSink);

  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return runesFor(edition).filter((stat) => {
      if (family !== "all" && stat.family !== family) return false;
      if (!needle) return true;
      return `${stat.name} ${stat.short}`.toLocaleLowerCase("fr").includes(needle);
    });
  }, [edition, family, query]);

  const hand = runesFor(edition).find((stat) => stat.id === handId) ?? runesFor(edition)[0];
  const held = hand ? gradeOf(hand, grade) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 rounded-full border border-edge bg-moss p-1">
        <button
          type="button"
          onClick={() => setEdition("unity")}
          className={
            "min-h-11 rounded-full text-sm font-medium " +
            (edition === "unity" ? "bg-lamp text-lamp-ink" : "text-mist")
          }
        >
          Dofus 3
        </button>
        <button
          type="button"
          onClick={() => setEdition("retro")}
          className={
            "min-h-11 rounded-full text-sm font-medium " +
            (edition === "retro" ? "bg-paper text-ink" : "text-mist")
          }
        >
          Rétro
        </button>
      </div>
      <p className="text-sm text-mist">
        {edition === "unity"
          ? "Poids du client Unity. La vitalité pèse 0,2, le critique 10. Ce n’est pas la table Rétro."
          : "Table Rétro, comme le pupitre Multifus : critique à 30, soin à 20, vitalité arrondie."}
      </p>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Chercher une rune"
        aria-label="Chercher une rune"
        className="min-h-11 rounded-xl border border-edge bg-moss px-3 placeholder:text-mist"
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        <FamilyChip active={family === "all"} label="Toutes" onClick={() => setFamily("all")} />
        {FAMILY_ORDER.map((id) => (
          <FamilyChip
            key={id}
            active={family === id}
            label={FAMILY_LABEL[id]}
            onClick={() => setFamily(id)}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-card bg-paper text-ink">
        <div className="border-b border-ink/10 px-3 py-2 text-xs font-medium tracking-wide text-ink/50 uppercase">
          Stat · poids · rune, Pa, Ra · over
        </div>
        <ul>
          {rows.map((stat) => {
            const selected = hand?.id === stat.id;
            return (
              <li key={stat.id} className={selected ? "bg-lamp/35" : undefined}>
                <button
                  type="button"
                  onClick={() => setHand(stat.id, "rune")}
                  className="flex w-full flex-col gap-1 px-3 py-3 text-left"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{stat.short}</span>
                      <span className="block truncate text-xs text-ink/55">{stat.name}</span>
                    </span>
                    <span className="shrink-0 text-sm">
                      {formatWeight(stat.unit)}
                      <span className="text-ink/45"> /pt</span>
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/70">
                    <Tier label="Rune" tier={stat.rune} />
                    <Tier label="Pa" tier={stat.pa} />
                    <Tier label="Ra" tier={stat.ra} />
                    <span>Over {stat.over ?? "—"}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {rows.length === 0 ? (
            <li className="px-3 py-6 text-sm text-ink/60">Aucune rune pour cette recherche.</li>
          ) : null}
        </ul>
      </div>

      {hand && edition === "unity" ? (
        <section className="rounded-card border border-edge bg-moss p-4">
          <h3 className="font-medium">Rune en main · {hand.short}</h3>
          <p className="text-sm text-mist">{hand.name}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {GRADES.map((item) => {
              const tier = gradeOf(hand, item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!tier}
                  onClick={() => setGrade(item.id)}
                  className={
                    "min-h-12 rounded-2xl border px-2 text-sm " +
                    (grade === item.id
                      ? "border-lamp bg-lamp text-lamp-ink"
                      : "border-edge disabled:text-mist/40")
                  }
                >
                  <span className="block font-medium">{item.label}</span>
                  <span className="block text-xs">
                    {tier ? `+${formatWeight(tier.bonus)} · ${formatWeight(tier.weight)}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="mt-4 block text-sm text-mist" htmlFor="sink">
            Puits déjà sur l'item
          </label>
          <input
            id="sink"
            inputMode="decimal"
            value={sink}
            onChange={(event) => setSink(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-edge bg-pine px-3"
          />
          {held ? <SinkReadout sink={parseSink(sink)} weight={held.weight} /> : null}
        </section>
      ) : null}
    </div>
  );
}

function FamilyChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "min-h-11 shrink-0 rounded-full border px-3 text-sm " +
        (active ? "border-lamp bg-lamp text-lamp-ink" : "border-edge text-mist")
      }
    >
      {label}
    </button>
  );
}

function SinkReadout({ sink, weight }: { sink: number; weight: number }) {
  const gap = Math.round((weight - sink) * 100) / 100;
  if (gap <= 0) {
    const left = Math.round((sink - weight) * 100) / 100;
    return (
      <p className="mt-3 text-sm text-fog">
        Le puits couvre cette rune. Reliquat {formatWeight(left)}.
      </p>
    );
  }
  return (
    <p className="mt-3 text-sm text-clay">
      Puits trop court de {formatWeight(gap)}. Une réussite neutre peut faire bouger une autre ligne.
    </p>
  );
}

function Tier({ label, tier }: { label: string; tier: RuneStat["rune"] | null }) {
  if (!tier) return <span className="text-ink/35">{label} —</span>;
  return (
    <span>
      {label} +{formatWeight(tier.bonus)} · {formatWeight(tier.weight)}
    </span>
  );
}

function parseSink(value: string): number {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
