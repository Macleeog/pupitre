import { useEffect, useState } from "react";
import { usePupitre } from "@/lib/pupitre/store";
import {
  SHORTCUT_ACTIONS,
  acceleratorFromEvent,
  duplicates,
  formatAccelerator,
} from "@/lib/pupitre/shortcuts";
import type { ShortcutAction } from "@/pupitre-desktop";

export function ShortcutsView() {
  const shortcuts = usePupitre((state) => state.shortcuts);
  const status = usePupitre((state) => state.shortcutStatus);
  const setShortcut = usePupitre((state) => state.setShortcut);
  const resetShortcuts = usePupitre((state) => state.resetShortcuts);
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [error, setError] = useState("");
  const desktop = typeof window !== "undefined" && Boolean(window.pupitre?.shortcuts);
  const clashes = duplicates(shortcuts);

  useEffect(() => {
    if (!recording) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecording(null);
        setError("");
        return;
      }
      const captured = acceleratorFromEvent(event);
      if (!captured) return;
      if ("error" in captured) {
        setError(captured.error);
        return;
      }
      setShortcut(recording, captured.accelerator);
      setRecording(null);
      setError("");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, setShortcut]);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-card border border-edge bg-moss p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-medium text-fog">Raccourcis clavier</h2>
            <p className="mt-1 text-sm text-mist">
              Ils marchent partout sous Windows, même quand Dofus est au premier plan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setRecording(null);
              resetShortcuts();
            }}
            className="min-h-11 shrink-0 rounded-full border border-edge bg-pine px-4 text-sm font-medium text-fog"
          >
            Rétablir les défauts
          </button>
        </div>
        {!desktop ? (
          <p className="mt-3 rounded-card border border-edge bg-pine px-3 py-2 text-sm text-mist">
            Les raccourcis globaux ne marchent que dans Pupitre.exe. Tu peux les préparer ici.
          </p>
        ) : null}
        <ul className="mt-4 flex flex-col gap-2">
          {SHORTCUT_ACTIONS.map((action) => {
            const accelerator = shortcuts[action.id];
            const active = recording === action.id;
            const clash = clashes.has(action.id);
            const failed = !clash && status[action.id] === "failed";
            return (
              <li
                key={action.id}
                className={
                  "flex flex-wrap items-center gap-3 rounded-xl border p-3 " +
                  (active ? "border-lamp bg-canopy" : "border-edge bg-pine")
                }
              >
                <div className="min-w-0 flex-1 basis-48">
                  <p className="text-sm font-medium text-fog">{action.label}</p>
                  <p className="text-xs text-mist">{action.hint}</p>
                  {clash ? <p className="mt-1 text-xs text-clay">Même combinaison qu'une autre action.</p> : null}
                  {failed ? (
                    <p className="mt-1 text-xs text-clay">Déjà utilisé par une autre application. Choisis-en un autre.</p>
                  ) : null}
                </div>
                <kbd
                  className={
                    "min-w-28 rounded-lg border px-3 py-2 text-center font-mono text-sm " +
                    (active
                      ? "border-lamp text-lamp"
                      : clash || failed
                        ? "border-clay/60 text-clay"
                        : accelerator
                          ? "border-edge text-fog"
                          : "border-edge text-mist")
                  }
                >
                  {active ? "Appuie…" : formatAccelerator(accelerator)}
                </kbd>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setRecording(active ? null : action.id);
                    }}
                    className={
                      "min-h-11 rounded-full px-4 text-sm font-medium " +
                      (active ? "border border-edge text-fog" : "bg-lamp text-lamp-ink")
                    }
                  >
                    {active ? "Annuler" : "Modifier"}
                  </button>
                  <button
                    type="button"
                    disabled={!accelerator}
                    onClick={() => {
                      if (active) setRecording(null);
                      setShortcut(action.id, "");
                    }}
                    className="min-h-11 rounded-full border border-edge px-4 text-sm text-fog disabled:opacity-40"
                  >
                    Effacer
                  </button>
                </div>
                {active ? (
                  <p className="basis-full text-xs text-lamp" role="status">
                    {error || "Appuie sur la combinaison voulue, par exemple Ctrl+Maj+F6. Échap annule."}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
