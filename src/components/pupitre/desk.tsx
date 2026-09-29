import { useEffect, useState } from "react";
import { BringToFront, CircleDot, Keyboard, Radio } from "lucide-react";
import { classById } from "@/lib/pupitre/classes";
import { usePupitre, type DeskTab } from "@/lib/pupitre/store";
import { Sigil } from "@/components/pupitre/sigil";
import { TourView } from "@/components/pupitre/tour-view";
import { WheelView } from "@/components/pupitre/wheel-view";
import { FarmView } from "@/components/pupitre/farm-view";
import { NetworkView } from "@/components/pupitre/network-view";
import { ShortcutsView } from "@/components/pupitre/shortcuts-view";
import { bindGameEvents } from "@/lib/pupitre/game-net";
import { bindFarmHotkeys, bindFarmSync } from "@/lib/pupitre/farm-sync";
import { bindShortcuts } from "@/lib/pupitre/shortcuts";

const TABS: { id: DeskTab; label: string; icon: typeof BringToFront }[] = [
  { id: "tour", label: "Tour", icon: BringToFront },
  { id: "roue", label: "Roue", icon: CircleDot },
  { id: "reseau", label: "Réseau", icon: Radio },
  { id: "raccourcis", label: "Raccourcis", icon: Keyboard },
];

export function Desk() {
  const tab = usePupitre((state) => state.tab);
  const setTab = usePupitre((state) => state.setTab);
  const advance = usePupitre((state) => state.advance);
  const setFocus = usePupitre((state) => state.setFocus);
  const characters = usePupitre((state) => state.characters);
  const focusId = usePupitre((state) => state.focusId);
  const focus = characters.find((character) => character.id === focusId) ?? null;
  const onTour = tab === "tour";
  const frame = onTour || tab === "reseau" ? "max-w-6xl" : "max-w-3xl";

  useEffect(() => {
    void usePupitre.persist.rehydrate();
    const unbindSync = bindFarmSync();
    const unbindKeys = bindFarmHotkeys();
    const unbindGame = bindGameEvents();
    const unbindShortcuts = bindShortcuts();
    return () => {
      unbindShortcuts();
      unbindSync();
      unbindKeys();
      unbindGame();
    };
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
              L'application de la team. Tu confirmes le tour, la roue dit qui mettre devant.
            </p>
            <p className="mt-2 max-w-sm text-xs text-mist">
              Fan site. Aucun lien avec Ankama. Dofus, ses symboles et illustrations de classes sont la propriété
              d'Ankama.
            </p>
          </div>
          {focus ? (
            <div className="hidden shrink-0 items-center gap-2 rounded-full border border-edge bg-moss py-1 pr-3 pl-1 sm:flex">
              <Sigil id={focus.classId} className="size-9" />
              <span className="text-sm">
                <span className="block leading-tight font-medium">{focus.name}</span>
                <span className="text-mist">{classById(focus.classId).name}</span>
              </span>
            </div>
          ) : null}
        </div>
      </header>

      <main className={"mx-auto w-full px-4 pt-5 pb-28 " + frame}>
        {onTour ? (
          <div className="flex flex-col gap-6">
            <FarmView />
            <TourView />
          </div>
        ) : null}
        {tab === "roue" ? <WheelView /> : null}
        {tab === "reseau" ? <NetworkView /> : null}
        {tab === "raccourcis" ? <ShortcutsView /> : null}
        <About />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-edge bg-moss/95 backdrop-blur"
        aria-label="Sections"
      >
        <div className={"mx-auto grid grid-cols-4 px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] " + frame}>
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = item.id === "tour" ? onTour : tab === item.id;
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

function About() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-8 border-t border-edge pt-4 text-sm text-mist">
      <button type="button" className="min-h-11 font-medium text-fog" onClick={() => setOpen((value) => !value)}>
        {open ? "Fermer la note" : "Ce que Pupitre ne fait pas"}
      </button>
      {open ? (
        <p className="mt-2 max-w-prose">
          Pupitre est un fan site. Il n'est pas lié, approuvé ni soutenu par Ankama. Dofus, Dofus Touch et
          Ankama sont des marques d'Ankama. L'exe pose un bandeau sur la fenêtre du jeu et accepte des raccourcis
          pour la session. Avec Wireshark installé, il lit en lecture seule les messages du jeu (onglet Réseau) :
          il ne les modifie pas et n'envoie rien au serveur.
        </p>
      ) : null}
    </section>
  );
}
