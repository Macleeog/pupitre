import { useEffect, useState } from "react";
import { FolderOpen, RotateCw, Store, Swords, Circle, Square, TriangleAlert, UserCheck } from "lucide-react";
import { fightLoot, hasLoot, useNetState } from "@/lib/pupitre/game-net";
import { useItemNames } from "@/lib/pupitre/items";
import { usePupitre } from "@/lib/pupitre/store";
import type { FightEnd, FightEvent, NetState, NetStatus } from "@/pupitre-desktop";

const STATUS: Record<NetStatus, { label: string; tone: string }> = {
  idle: { label: "En attente", tone: "border-edge text-mist" },
  unsupported: { label: "Indisponible", tone: "border-edge text-mist" },
  missing: { label: "Wireshark manquant", tone: "border-clay/60 text-clay" },
  starting: { label: "Démarrage", tone: "border-lamp/60 text-lamp" },
  listening: { label: "À l'écoute", tone: "border-lamp/60 text-lamp" },
  stopped: { label: "Arrêtée", tone: "border-edge text-mist" },
  error: { label: "Erreur", tone: "border-clay/60 text-clay" },
};

const numbers = new Intl.NumberFormat("fr-FR");

function ago(at: number | null, now: number): string {
  if (!at) return "jamais";
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.round(minutes / 60)} h`;
}

function clock(at: number): string {
  return new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function describeFight(event: FightEvent | null): string {
  if (!event) return "Aucun combat vu depuis le lancement.";
  if (event.type === "fight-start") return `Combat commencé à ${clock(event.at)}, ${event.fighters} combattants.`;
  if (event.type === "fight-end") return `Dernier combat terminé à ${clock(event.at)}.`;
  if (event.type === "turn-start") return `Tour du combattant ${event.fighterId} (${clock(event.at)}).`;
  return `Fin de tour du combattant ${event.fighterId} (${clock(event.at)}).`;
}

export function NetworkView() {
  const state = useNetState();
  const available = typeof window !== "undefined" && Boolean(window.pupitre?.net);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!available) {
    return (
      <div className="flex flex-col gap-4">
        <section className="rounded-card border border-edge bg-moss p-4">
          <h2 className="font-medium text-fog">Lecture du réseau</h2>
          <p className="mt-2 text-sm text-mist">
            Disponible dans Pupitre.exe sous Windows. Le navigateur ne peut pas lire la connexion du jeu.
          </p>
        </section>
        <SetupHelp />
      </div>
    );
  }

  if (!state) {
    return (
      <section className="rounded-card border border-edge bg-moss p-4 text-sm text-mist">Connexion au lecteur…</section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StatusCard state={state} now={now} />
      {state.codes?.state === "stale" ? <StaleCodes share={state.codes.knownShare ?? 0} /> : null}
      <FightCard state={state} />
      <MarketCard now={now} />
      <CaptureCard state={state} now={now} />
      {state.status === "missing" || state.status === "error" || state.status === "unsupported" ? <SetupHelp /> : null}
    </div>
  );
}

function StatusCard({ state, now }: { state: NetState; now: number }) {
  const status = STATUS[state.status];
  const [busy, setBusy] = useState(false);
  const listening = state.status === "listening";
  const waiting = listening && state.messages === 0;
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-card border border-edge bg-moss p-4">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm text-fog">
          <span className={"mr-2 rounded-full border px-2 py-0.5 text-xs font-medium " + status.tone}>{status.label}</span>
          {listening ? (waiting ? "aucun message pour l'instant" : `dernier message ${ago(state.lastMessageAt, now)}`) : null}
        </p>
        {state.detail ? <p className="mt-2 text-sm text-mist">{state.detail}</p> : null}
        {waiting ? (
          <p className="mt-2 text-sm text-mist">Lance Dofus, ou déconnecte-toi puis reconnecte un personnage.</p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void window.pupitre?.net?.restart().finally(() => setBusy(false));
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-edge bg-pine px-4 text-sm font-medium text-fog disabled:opacity-60"
      >
        <RotateCw className={"size-4" + (busy ? " animate-spin" : "")} aria-hidden="true" />
        Relancer la lecture
      </button>
    </section>
  );
}

function FightCard({ state }: { state: NetState }) {
  const autoCombats = usePupitre((s) => s.autoCombats);
  const setAutoCombats = usePupitre((s) => s.setAutoCombats);
  const autoLoot = usePupitre((s) => s.autoLoot);
  const setAutoLoot = usePupitre((s) => s.setAutoLoot);
  return (
    <section className="rounded-card border border-edge bg-moss p-4">
      <div className="flex items-center gap-3">
        <span
          className={
            "flex size-10 shrink-0 items-center justify-center rounded-full " +
            (state.inFight ? "bg-lamp text-lamp-ink" : "bg-pine text-mist")
          }
        >
          <Swords className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-medium text-fog">{state.inFight ? "En combat" : "Hors combat"}</h2>
          <p className="text-sm text-mist">{describeFight(state.lastFightEvent)}</p>
        </div>
      </div>
      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-fog">
        <input
          type="checkbox"
          checked={autoCombats}
          onChange={(event) => setAutoCombats(event.target.checked)}
          className="size-5 accent-[var(--color-lamp)]"
        />
        Ajouter +1 combat à la session de farm à la fin de chaque combat
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-fog">
        <input
          type="checkbox"
          checked={autoLoot}
          onChange={(event) => setAutoLoot(event.target.checked)}
          className="size-5 accent-[var(--color-lamp)]"
        />
        Ajouter les kamas et le butin aux ressources de la session
      </label>
      <p className="mt-1 text-xs text-mist">
        Seulement quand la session est en cours. La lecture du jeu démarre avec elle, ou quand cet onglet est ouvert,
        et s'arrête ensuite pour laisser le PC tranquille. Seul ton butin est ajouté : Pupitre reconnaît ton personnage
        la première fois qu'il lance un sort ou passe son tour, puis s'en souvient d'une fois sur l'autre.
      </p>
      <OwnFighters ids={state.ownFighterIds ?? []} />
      {state.lastFightEnd ? <LastFight fight={state.lastFightEnd} seen={state.fightsSeen} /> : null}
    </section>
  );
}

function OwnFighters({ ids }: { ids: string[] }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-edge bg-pine px-3 py-2">
      <UserCheck className={"size-4 shrink-0 " + (ids.length ? "text-lamp" : "text-mist")} aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-fog">
        {ids.length === 0
          ? "Personnage pas encore reconnu. Lance un sort pendant ton tour au prochain combat."
          : `${ids.length} personnage${ids.length > 1 ? "s" : ""} reconnu${ids.length > 1 ? "s" : ""}, gardé${ids.length > 1 ? "s" : ""} en mémoire.`}
      </p>
      {ids.length > 0 ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void window.pupitre?.net?.forgetOwn().finally(() => setBusy(false));
          }}
          className="min-h-11 rounded-full border border-edge px-4 text-sm text-fog disabled:opacity-60"
          title="À utiliser si tu changes de personnage : Pupitre le reconnaîtra au prochain combat."
        >
          Oublier
        </button>
      ) : null}
    </div>
  );
}

function MarketCard({ now }: { now: number }) {
  const hdvPrices = usePupitre((s) => s.hdvPrices);
  const forgetHdvPrices = usePupitre((s) => s.forgetHdvPrices);
  const entries = Object.entries(hdvPrices).sort(([, a], [, b]) => b.at - a.at);
  const names = useItemNames(entries.slice(0, 6).map(([id]) => Number(id)));
  const latest = entries[0]?.[1].at ?? null;
  return (
    <section className="rounded-card border border-edge bg-moss p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pine text-mist">
          <Store className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-fog">Hôtel des ventes</h2>
          <p className="text-sm text-mist">
            {entries.length === 0
              ? "Aucun prix pour l'instant."
              : `${entries.length} prix gardé${entries.length > 1 ? "s" : ""} en mémoire, mis à jour ${ago(latest, now)}.`}
          </p>
        </div>
        {entries.length > 0 ? (
          <button
            type="button"
            onClick={forgetHdvPrices}
            className="min-h-11 rounded-full border border-edge px-4 text-sm text-fog"
            title="Les prix déjà recopiés dans la session restent."
          >
            Oublier
          </button>
        ) : null}
      </div>
      {entries.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {entries.slice(0, 6).map(([id, price]) => (
            <li key={id} className="flex justify-between gap-3 rounded-lg bg-pine px-3 py-1.5">
              <span className="min-w-0 truncate text-fog">{names.get(Number(id)) ?? `Objet ${id}`}</span>
              <span className="shrink-0 text-mist">{numbers.format(price.unit)} K / u</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-xs text-mist">
        À l'hôtel des ventes, Pupitre lit les prix que le jeu t'affiche : ceux de tes objets en vente, et ceux du
        marché quand tu consultes un objet en mode achat. Il garde le lot le moins cher par unité et l'applique à tes
        ressources. Un prix tapé à la main n'est jamais remplacé.
      </p>
    </section>
  );
}

function StaleCodes({ share }: { share: number }) {
  return (
    <section className="flex gap-3 rounded-card border border-clay/60 bg-clay/15 p-4">
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-clay" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <h2 className="font-medium text-fog">Dofus a sans doute changé ses codes</h2>
        <p className="mt-1 text-fog">
          Des messages arrivent, mais seuls {Math.round(share * 100)} % de leurs types sont connus de Pupitre.
          Après une mise à jour du jeu, Ankama renomme ses codes : les combats et le butin risquent de ne plus être
          détectés.
        </p>
        <p className="mt-2 text-mist">
          Fais une capture des paquets pendant un combat complet, puis envoie le fichier pour une mise à jour de
          Pupitre.
        </p>
      </div>
    </section>
  );
}

function LastFight({ fight, seen }: { fight: FightEnd; seen: number }) {
  const results = fight.results ?? [];
  const names = useItemNames(results.flatMap((result) => result.items.map((item) => item.itemId)));
  const { unattributed } = fightLoot(fight);
  return (
    <div className="mt-4 rounded-xl border border-edge bg-pine p-3">
      <p className="text-xs font-medium tracking-widest text-mist uppercase">
        Dernier combat · {clock(fight.at)}
        {fight.durationMs ? ` · ${Math.round(fight.durationMs / 1000)} s` : ""} · {seen} vu{seen > 1 ? "s" : ""}
      </p>
      {results.length === 0 ? (
        <p className="mt-2 text-sm text-mist">Pas de résultat lisible dans la fin de combat.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {results.map((result) => (
            <li key={result.fighterId} className={result.mine ? "" : "opacity-60"}>
              <p className="text-fog">
                {result.mine ? (
                  <span className="mr-2 rounded-full bg-lamp px-2 py-0.5 text-xs font-medium text-lamp-ink">toi</span>
                ) : null}
                {numbers.format(result.xp)} XP · {numbers.format(result.kamas)} kamas
              </p>
              {hasLoot(result) && result.items.length > 0 ? (
                <p className="text-mist">
                  {result.items
                    .map((item) => `${item.quantity} × ${names.get(item.itemId) ?? `objet ${item.itemId}`}`)
                    .join(", ")}
                </p>
              ) : (
                <p className="text-mist">Pas de butin.</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {unattributed ? (
        <p className="mt-3 rounded-lg border border-clay/40 bg-clay/15 px-3 py-2 text-xs text-fog">
          Butin non attribué : plusieurs joueurs ont gagné quelque chose et Pupitre ne sait pas encore lequel est à
          toi. Rien n'a été ajouté. Lance un sort pendant ton tour au prochain combat, ou ajoute le butin à la main.
        </p>
      ) : null}
    </div>
  );
}

function CaptureCard({ state, now }: { state: NetState; now: number }) {
  const [busy, setBusy] = useState(false);
  const capture = state.capture;
  const toggle = async () => {
    setBusy(true);
    try {
      if (capture.active) await window.pupitre?.net?.stopCapture();
      else await window.pupitre?.net?.startCapture();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-card border border-edge bg-moss p-4">
      <h2 className="font-medium text-fog">Capture des paquets</h2>
      <p className="mt-1 text-sm text-mist">
        Enregistre chaque message décodé (type, sens, champs) dans un fichier sur ton PC, une ligne JSON par message.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || (!capture.active && state.status !== "listening")}
          onClick={() => void toggle()}
          className={
            "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium disabled:opacity-50 " +
            (capture.active ? "bg-clay text-fog" : "bg-lamp text-lamp-ink")
          }
        >
          {capture.active ? (
            <Square className="size-4" aria-hidden="true" />
          ) : (
            <Circle className="size-4" aria-hidden="true" />
          )}
          {capture.active ? "Arrêter la capture" : "Capturer les paquets"}
        </button>
        <button
          type="button"
          onClick={() => void window.pupitre?.net?.openFolder()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-edge bg-pine px-4 text-sm font-medium text-fog"
        >
          <FolderOpen className="size-4" aria-hidden="true" />
          Ouvrir le dossier
        </button>
      </div>
      {capture.active ? (
        <p className="mt-3 text-sm text-lamp">
          Capture en cours depuis {ago(capture.startedAt, now).replace("il y a ", "")} :{" "}
          {numbers.format(capture.count)} messages.
        </p>
      ) : null}
      {capture.file ? (
        <p className="mt-2 text-xs break-all text-mist">
          {capture.active ? "Fichier : " : `Dernière capture (${numbers.format(capture.count)} messages) : `}
          {capture.file}
        </p>
      ) : null}
    </section>
  );
}

function SetupHelp() {
  return (
    <section className="rounded-card border border-edge bg-moss p-4">
      <h2 className="font-medium text-fog">Installer la lecture du réseau</h2>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-fog">
        <li>
          Installe{" "}
          <a
            href="https://www.wireshark.org/download.html"
            target="_blank"
            rel="noreferrer"
            className="text-lamp underline underline-offset-2"
          >
            Wireshark
          </a>{" "}
          pour Windows, en gardant la case Npcap cochée pendant l'installation.
        </li>
        <li>Redémarre Pupitre, puis ouvre l'onglet Réseau.</li>
        <li>Lance Dofus et connecte un personnage. Si Pupitre démarre après Dofus, il se cale au message suivant.</li>
      </ol>
      <p className="mt-3 rounded-card border border-clay/40 bg-clay/15 px-3 py-2 text-xs text-fog">
        Les conditions d'utilisation d'Ankama interdisent les logiciels tiers qui lisent le trafic du jeu. Pupitre
        ne modifie rien, mais l'utiliser reste à tes risques pour ton compte.
      </p>
    </section>
  );
}
