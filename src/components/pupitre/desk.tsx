import { useEffect, useState } from "react";
import { BringToFront, CircleDot, ClipboardType, Table2, Timer } from "lucide-react";
import { classById } from "@/lib/pupitre/classes";
import { usePupitre, type DeskTab, type ServerMode } from "@/lib/pupitre/store";
import { Sigil } from "@/components/pupitre/sigil";
import { TourView } from "@/components/pupitre/tour-view";
import { WheelView } from "@/components/pupitre/wheel-view";
import { RunesView } from "@/components/pupitre/runes-view";
import { TextsView } from "@/components/pupitre/texts-view";
import { FarmView } from "@/components/pupitre/farm-view";

const TABS: { id: DeskTab; label: string; icon: typeof BringToFront }[] = [
  { id: "tour", label: "Tour", icon: BringToFront },
  { id: "roue", label: "Roue", icon: CircleDot },
  { id: "runes", label: "Runes", icon: Table2 },
  { id: "textes", label: "Textes", icon: ClipboardType },
  { id: "farm", label: "Farm", icon: Timer },
];

export function Desk() {
  const tab = usePupitre((state) => state.tab);
  const setTab = usePupitre((state) => state.setTab);
  const mode = usePupitre((state) => state.mode);
  const setMode = usePupitre((state) => state.setMode);
  const advance = usePupitre((state) => state.advance);
  const setFocus = usePupitre((state) => state.setFocus);
  const characters = usePupitre((state) => state.characters);
  const focusId = usePupitre((state) => state.focusId);
  const focus = characters.find((character) => character.id === focusId) ?? null;
  const frame = tab === "farm" ? "max-w-6xl" : "max-w-3xl";

  useEffect(() => {
    void usePupitre.persist.rehydrate();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        advance();
        setTab("tour");
      }
      const digit = Number(event.key);
      if (digit >= 1 && digit <= 9) {
        const character = characters[digit - 1];
        if (character) setFocus(character.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, characters, setFocus, setTab]);

  return (
    <div className="min-h-dvh bg-pine text-fog">
      <header className={"mx-auto flex w-full flex-col gap-4 px-4 pt-5 " + frame}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-widest text-lamp uppercase">Dofus 3</p>
            <h1 className="font-display text-4xl leading-none text-fog">Pupitre</h1>
            <p className="mt-2 max-w-sm text-sm text-mist">
              Le second écran de la team. Tu confirmes le tour, la roue dit qui mettre devant.
            </p>
          </div>
          {focus ? (
            <div className="hidden shrink-0 items-center gap-2 rounded-full border border-edge bg-moss py-1 pr-3 pl-1 sm:flex">
              <span className="flex size-9 items-center justify-center rounded-full bg-lamp text-lamp-ink">
                <Sigil id={focus.classId} className="size-5" />
              </span>
              <span className="text-sm">
                <span className="block leading-tight font-medium">{focus.name}</span>
                <span className="text-mist">{classById(focus.classId).name}</span>
              </span>
            </div>
          ) : null}
        </div>
        <ModeSwitch mode={mode} onChange={setMode} />
        {mode === "mono" ? (
          <p className="rounded-card border border-clay/40 bg-clay/15 px-3 py-2 text-sm text-fog">
            Serveur monocompte : un seul compte à la fois. Pupitre ne sert pas à en ouvrir un second.
          </p>
        ) : (
          <p className="text-sm text-mist">
            Classique : plusieurs fenêtres, sauf prisme et combats d'alliance, où un seul compte est autorisé.
          </p>
        )}
      </header>

      <main className={"mx-auto w-full px-4 pt-5 pb-28 " + frame}>
        {tab === "tour" ? <TourView /> : null}
        {tab === "roue" ? <WheelView /> : null}
        {tab === "runes" ? <RunesView /> : null}
        {tab === "textes" ? <TextsView /> : null}
        {tab === "farm" ? <FarmView /> : null}
        <About />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-edge bg-moss/95 backdrop-blur"
        aria-label="Sections"
      >
        <div className={"mx-auto grid grid-cols-5 px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] " + frame}>
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={active ? "page" : undefined}
                className={
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium " +
                  (active ? "text-lamp" : "text-mist")
                }
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function ModeSwitch({ mode, onChange }: { mode: ServerMode; onChange: (mode: ServerMode) => void }) {
  return (
    <div className="grid grid-cols-2 rounded-full border border-edge bg-moss p-1" role="group" aria-label="Type de serveur">
      {(
        [
          ["classique", "Classique"],
          ["mono", "Monocompte"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={
            "min-h-11 rounded-full text-sm font-medium " +
            (mode === id ? "bg-lamp text-lamp-ink" : "text-mist")
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function About() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-8 border-t border-edge pt-4 text-sm text-mist">
      <button type="button" className="min-h-11 font-medium text-fog" onClick={() => setOpen((value) => !value)}>
        {open ? "Fermer la note" : "Ce que Pupitre ne fait pas"}
      </button>
      {open ? (
        <p className="mt-2 max-w-prose">
          Multifus, sur Dofus Rétro, amène tout seul la fenêtre du personnage dont c'est le tour.
          Un site ne peut pas lire le client Unity ni passer une fenêtre au premier plan. Pupitre garde
          la roue, l'ordre de passage, la table des runes 3.0, les textes à coller et un compteur de farm manuel.
          Indépendant d'Ankama et de l'auteur de Multifus. Dofus est une marque d'Ankama.
        </p>
      ) : null}
    </section>
  );
}
