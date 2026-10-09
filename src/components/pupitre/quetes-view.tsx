import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { loadDone, saveDone, withQuestDone, type DoneMap } from "@/lib/pupitre/guide-progress";
import {
  GUIDE_SECTIONS,
  OBJECTIVE_COUNTERS,
  allGuides,
  countGainsCounters,
  formatGuideLevel,
  gainsTotalKamas,
  getGuide,
  guideChapters,
  guideIconUrl,
  guideProgress,
  type GuideDefinition,
  type GuideSection,
} from "@/lib/pupitre/guides";
import { copyTravel } from "@/lib/pupitre/watch-settings";
import { getWalkthrough } from "@/lib/pupitre/walkthroughs";
import type { WalkthroughStep } from "@/lib/pupitre/walkthrough-parse";

function kamas(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} kamas`;
}

export function QuetesView() {
  const [done, setDone] = useState<DoneMap>({});
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<GuideSection | "all">("all");
  const [slug, setSlug] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDone(loadDone());
    setReady(true);
  }, []);

  const guide = slug ? getGuide(slug) : undefined;
  const toggle = (questId: number, checked: boolean) => {
    const next = withQuestDone(done, questId, checked);
    setDone(next);
    saveDone(next);
  };

  if (!ready) {
    return <p className="text-sm text-mist">Chargement des guides…</p>;
  }
  if (guide) {
    return <GuideScreen guide={guide} done={done} onBack={() => setSlug(null)} onToggle={toggle} />;
  }
  return (
    <GuideList
      done={done}
      query={query}
      section={section}
      onQuery={setQuery}
      onSection={setSection}
      onOpen={setSlug}
    />
  );
}

function GuideList({
  done,
  query,
  section,
  onQuery,
  onSection,
  onOpen,
}: {
  done: DoneMap;
  query: string;
  section: GuideSection | "all";
  onQuery: (value: string) => void;
  onSection: (value: GuideSection | "all") => void;
  onOpen: (slug: string) => void;
}) {
  const guides = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return allGuides().filter((guide) => {
      if (section !== "all" && guide.section !== section) return false;
      if (!needle) return true;
      return guide.title.toLocaleLowerCase("fr").includes(needle);
    });
  }, [query, section]);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-card border border-edge bg-moss p-4">
        <h2 className="font-medium text-fog">Guides de quêtes</h2>
        <p className="mt-1 text-sm text-mist">
          Coche une quête pour avancer dans le guide. Une position copie <span className="text-fog">/travel</span> dans le
          presse-papiers.
        </p>
        <label className="mt-3 flex min-h-11 items-center gap-2 rounded-full border border-edge bg-pine px-3">
          <Search className="size-4 text-mist" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Chercher un Dofus, un alignement…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-fog outline-none placeholder:text-mist"
          />
        </label>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={section === "all"} onClick={() => onSection("all")}>
            Tous
          </FilterChip>
          {GUIDE_SECTIONS.map((item) => (
            <FilterChip key={item.id} active={section === item.id} onClick={() => onSection(item.id)}>
              {item.label}
            </FilterChip>
          ))}
        </div>
      </section>

      {guides.length === 0 ? (
        <p className="rounded-card border border-edge bg-moss px-4 py-6 text-sm text-mist">Aucun guide pour cette recherche.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {guides.map((guide) => {
            const progress = guideProgress(guide, done);
            const icon = guideIconUrl(guide);
            return (
              <li key={guide.slug}>
                <button
                  type="button"
                  onClick={() => onOpen(guide.slug)}
                  className="flex w-full items-center gap-3 rounded-card border border-edge bg-moss p-3 text-left hover:border-lamp"
                >
                  {icon ? (
                    <img src={icon} alt="" className="size-12 shrink-0 rounded-lg bg-pine object-contain" />
                  ) : (
                    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-pine text-xs text-mist">Dofus</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-fog">{guide.title}</span>
                    <span className="mt-0.5 block text-xs text-mist">
                      {formatGuideLevel(guide.levelMin, guide.levelMax)} · {progress.done}/{progress.total}
                    </span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-pine">
                      <span className="block h-full bg-lamp" style={{ width: `${progress.pct}%` }} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-mist">Données issues de DofusDB. Utilisation soumise à la LPNC-IA 1.0.</p>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium " +
        (active ? "border-lamp bg-lamp text-lamp-ink" : "border-edge text-mist")
      }
    >
      {children}
    </button>
  );
}

function GuideScreen({
  guide,
  done,
  onBack,
  onToggle,
}: {
  guide: GuideDefinition;
  done: DoneMap;
  onBack: () => void;
  onToggle: (questId: number, checked: boolean) => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const progress = guideProgress(guide, done);
  const icon = guideIconUrl(guide);
  const chapters = guideChapters(guide);
  const counters = guide.gains ? countGainsCounters(guide.gains, done) : null;

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-sm text-lamp">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tous les guides
      </button>
      <section className="rounded-card border border-edge bg-moss p-4">
        <div className="flex items-start gap-3">
          {icon ? <img src={icon} alt="" className="size-16 rounded-xl bg-pine object-contain" /> : null}
          <div className="min-w-0">
            <h2 className="font-display text-3xl leading-none text-fog">{guide.title}</h2>
            <p className="mt-2 text-sm text-mist">
              {formatGuideLevel(guide.levelMin, guide.levelMax)} · {progress.done}/{progress.total} quêtes · {progress.pct} %
            </p>
          </div>
        </div>
        {guide.notice ? <p className="mt-3 text-sm text-mist">{guide.notice}</p> : null}
        {guide.gains ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Stat label="Quêtes" value={kamas(guide.gains.kamasQuest)} />
            <Stat label="Succès" value={kamas(guide.gains.kamasAchievement)} />
            <Stat label="Total" value={kamas(gainsTotalKamas(guide.gains))} />
          </div>
        ) : null}
        {counters ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {OBJECTIVE_COUNTERS.map((kind) => (
              <li key={kind.id} className="rounded-full border border-edge px-3 py-1 text-xs text-mist">
                {kind.label} {counters.done[kind.id]}/{counters.total[kind.id]}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {chapters.map((chapter) => (
        <section key={chapter.title} className="rounded-card border border-edge bg-moss p-4">
          <h3 className="font-medium text-fog">
            {chapter.kind === "prereq" ? "Prérequis · " : ""}
            {chapter.title}
          </h3>
          {chapter.info ? <p className="mt-1 text-sm text-mist">{chapter.info}</p> : null}
          <ul className="mt-3 flex flex-col gap-2">
            {chapter.questIds.map((questId) => {
              const walkthrough = getWalkthrough(questId);
              const checked = done[String(questId)] === true;
              const open = openId === questId;
              return (
                <li key={questId} className="rounded-xl border border-edge bg-pine/70">
                  <div className="flex items-start gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-[#b7dc69]"
                      checked={checked}
                      onChange={(event) => onToggle(questId, event.target.checked)}
                      aria-label={walkthrough?.name ?? `Quête ${questId}`}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 py-1 text-left"
                      onClick={() => setOpenId(open ? null : questId)}
                    >
                      <span className={"block text-sm " + (checked ? "text-mist line-through" : "text-fog")}>
                        {walkthrough?.name ?? `Quête ${questId}`}
                      </span>
                      {walkthrough?.zone ? <span className="block text-xs text-mist">{walkthrough.zone}</span> : null}
                    </button>
                  </div>
                  {open ? <Walkthrough steps={walkthrough?.steps ?? []} name={walkthrough?.name ?? null} /> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="text-xs text-mist">Données issues de DofusDB. Utilisation soumise à la LPNC-IA 1.0.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-pine px-3 py-2">
      <p className="text-xs text-mist">{label}</p>
      <p className="text-sm font-medium text-lamp">{value}</p>
    </div>
  );
}

function Walkthrough({ steps, name }: { steps: WalkthroughStep[]; name: string | null }) {
  if (steps.length === 0) {
    return (
      <p className="border-t border-edge px-3 py-3 text-sm text-mist">
        {name
          ? "Pas de marche à suivre enregistrée pour cette quête. Tu peux quand même la cocher."
          : "Cette quête n'a pas encore de texte de suivi. Tu peux la cocher quand elle est finie."}
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-2 border-t border-edge px-3 py-3">
      {steps.map((step, index) => (
        <li key={`${step.type}-${index}`} className="text-sm text-fog">
          <p>
            {step.npc ? <span className="text-lamp">{step.npc}. </span> : null}
            {step.text}
          </p>
          {typeof step.x === "number" && typeof step.y === "number" ? <TravelChip x={step.x} y={step.y} /> : null}
        </li>
      ))}
    </ol>
  );
}

function TravelChip({ x, y }: { x: number; y: number }) {
  const [copied, setCopied] = useState(false);
  const command = `/travel ${x},${y}`;
  return (
    <button
      type="button"
      className="mt-1 rounded-full border border-lamp/50 px-2 py-0.5 text-xs text-lamp"
      onClick={() => {
        void copyTravel(command).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
    >
      {copied ? "copié" : `[${x},${y}]`}
    </button>
  );
}
