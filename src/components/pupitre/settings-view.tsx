import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { OVERLAY_FIELDS, usePupitre } from "@/lib/pupitre/store";
import { overlayCapacity } from "@/lib/pupitre/overlay";
import { useUpdateState } from "@/lib/pupitre/updates";
import { ShortcutsView } from "@/components/pupitre/shortcuts-view";
import type { OverlaySize, UpdateState } from "@/pupitre-desktop";

const RELEASES = "https://github.com/Macleeog/pupitre/releases";

export function SettingsView() {
  return (
    <div className="flex flex-col gap-4">
      <WantedCard />
      <UpdatesCard />
      <OverlayCard />
      <ShortcutsView />
    </div>
  );
}

function updateText(update: UpdateState | null): string {
  if (!update) return "Les mises à jour automatiques marchent dans Pupitre installé sous Windows.";
  switch (update.status) {
    case "dev":
      return "Version de développement : pas de mise à jour automatique.";
    case "manual":
      return "Cette copie vient d'un zip et ne peut pas se remplacer seule. Installe Pupitre-Setup une fois : ensuite, les mises à jour arrivent toutes seules.";
    case "checking":
      return "Recherche d'une nouvelle version…";
    case "up-to-date":
      return "Tu as la dernière version.";
    case "downloading":
      return `Téléchargement de la version ${update.available ?? ""} : ${update.progress} %.`;
    case "ready":
      return `La version ${update.available} est prête. Elle s'installe en redémarrant Pupitre, ou à la prochaine fermeture.`;
    case "error":
      return `La recherche a échoué : ${update.detail || "erreur inconnue"}. Pupitre réessaiera plus tard.`;
    default:
      return "Pupitre cherche les nouvelles versions au lancement, puis toutes les 4 heures.";
  }
}

function WantedCard() {
  const enabled = usePupitre((state) => state.wantedNotices);
  const setEnabled = usePupitre((state) => state.setWantedNotices);
  return (
    <section className="rounded-card border border-edge bg-moss p-4">
      <h2 className="font-medium text-fog">Avis de recherche</h2>
      <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm text-fog">
        <input
          type="checkbox"
          checked={enabled !== false}
          onChange={(event) => setEnabled(event.target.checked)}
          className="mt-0.5 size-5 accent-[var(--color-lamp)]"
        />
        <span>
          Prévenir quand il y en a un sur la carte
          <span className="mt-1 block text-mist">
            En arrivant sur une carte, Pupitre reconnaît les monstres du groupe. S'il y a un avis de recherche, une
            notification s'affiche. La lecture reste allumée tant que cette case est cochée.
          </span>
        </span>
      </label>
    </section>
  );
}

function UpdatesCard() {
  const update = useUpdateState();
  const [busy, setBusy] = useState(false);
  const canCheck = update && !["dev", "manual", "downloading", "ready"].includes(update.status);
  return (
    <section className="rounded-card border border-edge bg-moss p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="font-medium text-fog">Mises à jour</h2>
          <p className="mt-1 text-sm text-mist">
            {update ? `Version installée : ${update.version}. ` : ""}
            {updateText(update)}
          </p>
        </div>
        {update?.status === "ready" ? (
          <button
            type="button"
            onClick={() => window.pupitre?.updates?.install()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lamp px-4 text-sm font-medium text-lamp-ink"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Redémarrer maintenant
          </button>
        ) : update?.status === "manual" ? (
          <a
            href={RELEASES}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-lamp px-4 text-sm font-medium text-lamp-ink"
          >
            <Download className="size-4" aria-hidden="true" />
            Télécharger l'installateur
          </a>
        ) : canCheck ? (
          <button
            type="button"
            disabled={busy || update.status === "checking"}
            onClick={() => {
              setBusy(true);
              void window.pupitre?.updates?.check().finally(() => setBusy(false));
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-edge bg-pine px-4 text-sm font-medium text-fog disabled:opacity-60"
          >
            <RefreshCw className={"size-4" + (busy ? " animate-spin" : "")} aria-hidden="true" />
            Vérifier
          </button>
        ) : null}
      </div>
      {update?.status === "downloading" ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-pine">
          <div className="h-full bg-lamp transition-all" style={{ width: `${update.progress}%` }} />
        </div>
      ) : null}
    </section>
  );
}

const SIZES: { id: OverlaySize; label: string; hint: string }[] = [
  { id: "compact", label: "Petit", hint: "300 × 150" },
  { id: "large", label: "Grand", hint: "380 × 210" },
];

function OverlayCard() {
  const fields = usePupitre((state) => state.overlayFields);
  const toggle = usePupitre((state) => state.toggleOverlayField);
  const size = usePupitre((state) => state.overlaySize);
  const setSize = usePupitre((state) => state.setOverlaySize);
  const buttons = usePupitre((state) => state.overlayButtons);
  const setButtons = usePupitre((state) => state.setOverlayButtons);
  const capacity = overlayCapacity(size, buttons);
  return (
    <section className="rounded-card border border-edge bg-moss p-4">
      <h2 className="font-medium text-fog">Bandeau</h2>
      <p className="mt-1 text-sm text-mist">Ce que le bandeau affiche sur la fenêtre Dofus, en plus du chrono.</p>
      <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Taille du bandeau">
        {SIZES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="radio"
            aria-checked={size === entry.id}
            onClick={() => setSize(entry.id)}
            className={
              "min-h-12 rounded-xl border px-3 text-left " +
              (size === entry.id ? "border-lamp bg-canopy text-fog" : "border-edge bg-pine text-mist")
            }
          >
            <span className="block text-sm font-medium">{entry.label}</span>
            <span className="block text-xs">{entry.hint}</span>
          </button>
        ))}
      </div>
      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {OVERLAY_FIELDS.map((field) => {
          const index = fields.indexOf(field.id);
          const hidden = index >= capacity;
          return (
            <li key={field.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-fog">
                <input
                  type="checkbox"
                  checked={index !== -1}
                  onChange={() => toggle(field.id)}
                  className="size-5 accent-[var(--color-lamp)]"
                />
                {field.label}
                {index !== -1 && hidden ? <span className="text-xs text-clay">pas la place</span> : null}
              </label>
            </li>
          );
        })}
        <li>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-fog">
            <input
              type="checkbox"
              checked={buttons}
              onChange={(event) => setButtons(event.target.checked)}
              className="size-5 accent-[var(--color-lamp)]"
            />
            Boutons Start, Pause, Stop, +1
          </label>
        </li>
      </ul>
      <p className="mt-2 text-xs text-mist">
        Le {size === "compact" ? "petit" : "grand"} bandeau affiche {capacity} info{capacity > 1 ? "s" : ""}
        {buttons ? " avec les boutons" : " sans les boutons"}. Il garde sa taille quand tu le déplaces.
      </p>
    </section>
  );
}
