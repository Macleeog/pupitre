import { usePupitre } from "@/lib/pupitre/store";
import type { ShortcutAction, ShortcutMap } from "@/pupitre-desktop";

export const SHORTCUT_ACTIONS: { id: ShortcutAction; label: string; hint: string }[] = [
  { id: "overlay", label: "Afficher / masquer le bandeau", hint: "Le bandeau de session posé sur la fenêtre Dofus." },
  { id: "start", label: "Démarrer ou reprendre", hint: "Lance le chrono de la session de farm." },
  { id: "pause", label: "Pause", hint: "Met le chrono en pause." },
  { id: "stop", label: "Terminer", hint: "Termine la session et la range dans l'historique." },
  { id: "reset", label: "Remettre à zéro", hint: "Repart de zéro sans ranger la session dans l'historique." },
  { id: "combat", label: "+1 combat", hint: "Ajoute un combat à la session en cours." },
];

const KEY_NAMES: Record<string, string> = {
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  NumpadAdd: "numadd",
  NumpadSubtract: "numsub",
  NumpadMultiply: "nummult",
  NumpadDivide: "numdiv",
  NumpadDecimal: "numdec",
};

function keyName(event: KeyboardEvent): string | null {
  const { code, key } = event;
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code;
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `num${code.slice(6)}`;
  // Letters follow the layout (AZERTY A is A), like Windows virtual keys.
  if (/^[a-z]$/i.test(key)) return key.toUpperCase();
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  return KEY_NAMES[code] ?? null;
}

export type Captured = { accelerator: string } | { error: string } | null;

// Returns null while only modifiers are held.
export function acceleratorFromEvent(event: KeyboardEvent): Captured {
  if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(event.key)) return null;
  const key = keyName(event);
  if (!key) return { error: "Touche non prise en charge." };
  const modifiers = [
    event.ctrlKey ? "CommandOrControl" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
    event.metaKey ? "Super" : "",
  ].filter(Boolean);
  if (modifiers.length === 0 && !/^F\d+$/.test(key)) {
    return { error: "Ajoute Ctrl, Alt ou Maj : une touche seule gênerait la frappe dans le jeu." };
  }
  return { accelerator: [...modifiers, key].join("+") };
}

export function formatAccelerator(accelerator: string): string {
  if (!accelerator) return "Aucun";
  return accelerator
    .split("+")
    .map((part) => ({ CommandOrControl: "Ctrl", Shift: "Maj", Super: "Win" })[part] ?? part)
    .join("+");
}

export function duplicates(map: ShortcutMap): Set<ShortcutAction> {
  const seen = new Map<string, ShortcutAction>();
  const clashes = new Set<ShortcutAction>();
  for (const { id } of SHORTCUT_ACTIONS) {
    const key = map[id]?.toLowerCase();
    if (!key) continue;
    const first = seen.get(key);
    if (first) {
      clashes.add(first);
      clashes.add(id);
    } else {
      seen.set(key, id);
    }
  }
  return clashes;
}

// Main keeps its own copy (userData/shortcuts.json) so shortcuts work before the desk loads;
// the desk pushes every change and gets back what could be registered.
export function bindShortcuts(): () => void {
  const bridge = window.pupitre?.shortcuts;
  if (!bridge) return () => {};
  const push = (map: ShortcutMap) => {
    void bridge.set(map).then((status) => {
      if (status) usePupitre.getState().setShortcutStatus(status);
    });
  };
  push(usePupitre.getState().shortcuts);
  return usePupitre.subscribe((state, previous) => {
    if (state.shortcuts !== previous.shortcuts) push(state.shortcuts);
  });
}
