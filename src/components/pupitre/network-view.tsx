import { useEffect, useState } from "react";
import { FolderOpen, RotateCw, Swords, Circle, Square } from "lucide-react";
import { useNetState } from "@/lib/pupitre/game-net";
import { fetchItem } from "@/lib/pupitre/items";
import { usePupitre } from "@/lib/pupitre/store";
import type { FightEnd, GameEvent, NetState, NetStatus } from "@/pupitre-desktop";

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

function describeFight(event: GameEvent | null): string {
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Paquets" value={numbers.format(state.packets)} />
        <Stat label="Messages" value={numbers.format(state.messages)} />
        <Stat label="Types vus" value={numbers.format(state.distinctTypes)} />
        <Stat label="Dernier message" value={ago(state.lastMessageAt, now)} />
      </div>
      <FightCard state={state} />
      <CaptureCard state={state} now={now} />
      {state.status === "missing" || state.status === "error" ? <SetupHelp /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <TypesCard state={state} now={now} />
        <RecentCard state={state} />
      </div>
    </div>
  );
}

function StatusCard({ state, now }: { state: NetState; now: number }) {
  const status = STATUS[state.status];
  const [busy, setBusy] = useState(false);
  const waiting = state.status === "listening" && state.messages === 0;
  return (
    <section className="rounded-card border border-edge bg-moss p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-medium text-fog">Lecture du réseau</h2>
          <p className="mt-1 text-sm text-mist">
            Lecture seule : Pupitre copie les messages du jeu, sans rien modifier ni envoyer.
          </p>
        </div>
        <span className={"shrink-0 rounded-full border px-3 py-1 text-xs font-medium " + status.tone}>{status.label}</span>
      </div>
      {state.detail ? <p className="mt-3 text-sm text-fog">{state.detail}</p> : null}
      {state.status === "listening" ? (
        <p className="mt-3 text-sm text-mist">
          {state.interfaces} carte{state.interfaces > 1 ? "s" : ""} réseau écoutée{state.interfaces > 1 ? "s" : ""}, depuis{" "}
          {ago(state.startedAt, now).replace("il y a ", "")}.
          {waiting
            ? " Aucun message pour l'instant : lance Dofus, ou déconnecte-toi puis reconnecte un personnage."
            : null}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void window.pupitre?.net?.restart().finally(() => setBusy(false));
        }}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-edge bg-pine px-4 text-sm font-medium text-fog disabled:opacity-60"
      >
        <RotateCw className={"size-4" + (busy ? " animate-spin" : "")} aria-hidden="true" />
        Relancer la lecture
      </button>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-edge bg-moss px-4 py-3">
      <p className="text-xs font-medium tracking-widest text-mist uppercase">{label}</p>
      <p className="mt-1 truncate font-display text-2xl text-fog">{value}</p>
    </div>
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
        Seulement quand la session est en cours. En multicompte, un combat compte une fois. Le butin de tous les
        joueurs du combat est ajouté : en groupe avec d'autres joueurs, retire leur part à la main.
      </p>
      {state.lastFightEnd ? <LastFight fight={state.lastFightEnd} seen={state.fightsSeen} /> : null}
    </section>
  );
}

function LastFight({ fight, seen }: { fight: FightEnd; seen: number }) {
  const results = fight.results ?? [];
  const names = useItemNames(results.flatMap((result) => result.items.map((item) => item.itemId)));
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
            <li key={result.fighterId}>
              <p className="text-fog">
                {numbers.format(result.xp)} XP · {numbers.format(result.kamas)} kamas
              </p>
              {result.items.length > 0 ? (
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
    </div>
  );
}

function useItemNames(ids: number[]): Map<number, string> {
  const key = [...new Set(ids)].sort((a, b) => a - b).join(",");
  const [names, setNames] = useState(() => new Map<number, string>());
  useEffect(() => {
    if (!key) return;
    let alive = true;
    void Promise.all(key.split(",").map((id) => fetchItem(Number(id)))).then((items) => {
      if (!alive) return;
      setNames(new Map(items.flatMap((item) => (item ? [[item.id, item.name] as const] : []))));
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return names;
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

function TypesCard({ state, now }: { state: NetState; now: number }) {
  return (
    <section className="rounded-card border border-edge bg-moss p-4">
      <h2 className="font-medium text-fog">Types de messages</h2>
      <p className="mt-1 text-xs text-mist">Les noms sont les codes du jeu (type.ankama.com/…). Ankama les change aux mises à jour.</p>
      {state.types.length === 0 ? (
        <p className="mt-3 text-sm text-mist">Rien pour l'instant.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-mist">
              <tr>
                <th className="py-1 pr-3 font-medium">Type</th>
                <th className="py-1 pr-3 text-right font-medium">Reçus</th>
                <th className="py-1 pr-3 text-right font-medium">Envoyés</th>
                <th className="py-1 text-right font-medium">Vu</th>
              </tr>
            </thead>
            <tbody>
              {state.types.map((type) => (
                <tr key={type.type} className="border-t border-edge/60">
                  <td className="py-1.5 pr-3 font-mono text-fog">{type.type}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{numbers.format(type.in)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{numbers.format(type.out)}</td>
                  <td className="py-1.5 text-right whitespace-nowrap text-mist">{ago(type.lastAt, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RecentCard({ state }: { state: NetState }) {
  return (
    <section className="rounded-card border border-edge bg-moss p-4">
      <h2 className="font-medium text-fog">Derniers messages</h2>
      {state.recent.length === 0 ? (
        <p className="mt-3 text-sm text-mist">Rien pour l'instant.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {state.recent.map((message, index) => (
            <li key={`${message.at}-${index}`} className="flex items-baseline gap-3 border-t border-edge/60 pt-1">
              <span className="w-16 shrink-0 text-xs text-mist tabular-nums">{clock(message.at)}</span>
              <span className={"w-12 shrink-0 text-xs " + (message.direction === "in" ? "text-lamp" : "text-mist")}>
                {message.direction === "in" ? "reçu" : "envoyé"}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-fog">{message.type}</span>
              <span className="shrink-0 text-xs text-mist tabular-nums">{numbers.format(message.size)} o</span>
            </li>
          ))}
        </ul>
      )}
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
