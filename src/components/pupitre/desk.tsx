import { useEffect, useState } from "react";
import { Radio, RefreshCw, Settings, Timer } from "lucide-react";
import { classById } from "@/lib/pupitre/classes";
import { usePupitre, type DeskTab } from "@/lib/pupitre/store";
import { Sigil } from "@/components/pupitre/sigil";
import { CharacterView } from "@/components/pupitre/character-view";
import { FarmView } from "@/components/pupitre/farm-view";
import { NetworkView } from "@/components/pupitre/network-view";
import { SettingsView } from "@/components/pupitre/settings-view";
import { bindGameEvents } from "@/lib/pupitre/game-net";
import { bindFarmHotkeys, bindFarmSync } from "@/lib/pupitre/farm-sync";
import { bindShortcuts } from "@/lib/pupitre/shortcuts";
import { useUpdateState } from "@/lib/pupitre/updates";
import { APP_VERSION } from "@/lib/pupitre/version";
import { WantedSquares, type WantedCard } from "@/components/pupitre/wanted-toast";

const TABS: { id: DeskTab; label: string; icon: typeof Timer }[] = [
  { id: "session", label: "Session", icon: Timer },
  { id: "reseau", label: "Réseau", icon: Radio },
  { id: "reglages", label: "Réglages", icon: Settings },
];

export function Desk() {
  const tab = usePupitre((state) => state.tab);
  const setTab = usePupitre((state) => state.setTab);
  const me = usePupitre((state) => state.me);
  const overlaySize = usePupitre((state) => state.overlaySize);
  const [hydrated, setHydrated] = useState(false);
  const current = TABS.some((item) => item.id === tab) ? tab : "session";
  const frame = current === "reglages" ? "max-w-3xl" : "max-w-6xl";

  useEffect(() => {
    const syncReader = () => {
      const { farm, tab, wantedNotices, archiNotices } = usePupitre.getState();
      const notices = wantedNotices !== false;
      const archi = archiNotices !== false;
      window.pupitre?.net?.setActive?.(farm.status === "running" || tab === "reseau" || notices || archi);
      window.pupitre?.net?.setWantedNotices?.(notices);
      window.pupitre?.net?.setArchiNotices?.(archi);
    };
    const unsub = usePupitre.subscribe(syncReader);
    void Promise.resolve(usePupitre.persist.rehydrate()).then(() => {
      setHydrated(true);
      syncReader();
    });
    const unbindSync = bindFarmSync();
    const unbindKeys = bindFarmHotkeys();
    const unbindGame = bindGameEvents();
    const unbindShortcuts = bindShortcuts();
    return () => {
      unsub();
      unbindShortcuts();
      unbindSync();
      unbindKeys();
      unbindGame();
    };
  }, []);

  useEffect(() => {
    if (hydrated) window.pupitre?.overlaySize?.set(overlaySize);
  }, [hydrated, overlaySize]);

  return (
    <div className="min-h-dvh bg-pine text-fog">
      <header className={"mx-auto flex w-full flex-col gap-4 px-4 pt-5 " + frame}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-widest text-lamp uppercase">
              Dofus 3 <span className="tracking-normal text-mist normal-case">· v{APP_VERSION}</span>
            </p>
            <h1 className="font-display text-4xl leading-none text-fog">Pupitre</h1>
            <p className="mt-2 max-w-sm text-sm text-mist">Le compagnon de tes sessions de farm.</p>
            <p className="mt-2 max-w-sm text-xs text-mist">
              Fan site. Aucun lien avec Ankama. Dofus, ses symboles et illustrations de classes sont la propriété
              d'Ankama.
            </p>
          </div>
          {me ? (
            <div className="hidden shrink-0 items-center gap-2 rounded-full border border-edge bg-moss py-1 pr-3 pl-1 sm:flex">
              <Sigil id={me.classId} className="size-9" />
              <span className="text-sm">
                <span className="block leading-tight font-medium">{me.name}</span>
                <span className="text-mist">{classById(me.classId).name}</span>
              </span>
            </div>
          ) : null}
        </div>
        <UpdateBanner onOpen={() => setTab("reglages")} />
        <WantedBanner />
      </header>

      <main className={"mx-auto w-full px-4 pt-5 pb-28 " + frame}>
        {current === "session" ? (
          <div className="flex flex-col gap-6">
            <CharacterView />
            <FarmView />
          </div>
        ) : null}
        {current === "reseau" ? <NetworkView /> : null}
        {current === "reglages" ? <SettingsView /> : null}
        <About />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-edge bg-moss/95 backdrop-blur"
        aria-label="Sections"
      >
        <div className={"mx-auto grid grid-cols-3 px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] " + frame}>
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = current === item.id;
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

function WantedBanner() {
  const sighting = usePupitre((state) => state.lastWanted);
  const enabled = usePupitre((state) => state.wantedNotices);
  const archi = usePupitre((state) => state.archiNotices);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    setDesktop(Boolean(window.pupitre?.toast));
  }, []);
  if (desktop || (enabled === false && archi === false) || !sighting) return null;
  if (Date.now() - sighting.at > 10_000) return null;
  const monsters: WantedCard[] = sighting.monsters.slice(0, 3).map((monster) => ({
    id: monster.id,
    name: monster.name,
    gfxId: monster.gfxId,
    kind: monster.kind,
  }));
  return <WantedSquares key={sighting.at} monsters={monsters} coords={sighting.coords ?? null} />;
}

function UpdateBanner({ onOpen }: { onOpen: () => void }) {
  const update = useUpdateState();
  if (update?.status !== "ready") return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-lamp/60 bg-canopy px-4 py-3">
      <RefreshCw className="size-5 shrink-0 text-lamp" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-fog">
        La version {update.available} est prête. Elle s'installe en redémarrant Pupitre, ou à la prochaine fermeture.
      </p>
      <button
        type="button"
        onClick={() => window.pupitre?.updates?.install()}
        className="min-h-11 rounded-full bg-lamp px-4 text-sm font-medium text-lamp-ink"
      >
        Redémarrer
      </button>
      <button type="button" onClick={onOpen} className="min-h-11 px-2 text-sm text-mist">
        Détails
      </button>
    </div>
  );
}

function About() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-8 flex flex-wrap items-center justify-between gap-x-4 border-t border-edge pt-4 text-sm text-mist">
      <button type="button" className="min-h-11 font-medium text-fog" onClick={() => setOpen((value) => !value)}>
        {open ? "Fermer la note" : "Ce que Pupitre ne fait pas"}
      </button>
      <p className="min-h-11 py-2.5">Pupitre v{APP_VERSION}</p>
      {open ? (
        <p className="mt-2 max-w-prose basis-full">
          Pupitre est un fan site. Il n'est pas lié, approuvé ni soutenu par Ankama. Dofus, Dofus Touch et
          Ankama sont des marques d'Ankama. L'exe pose un bandeau sur la fenêtre du jeu et accepte des raccourcis
          pour la session. Avec Wireshark installé, il lit en lecture seule les messages du jeu (onglet Réseau) :
          il ne les modifie pas et n'envoie rien au serveur. Il vérifie les nouvelles versions sur GitHub.
        </p>
      ) : null}
    </section>
  );
}
