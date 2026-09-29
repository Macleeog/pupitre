import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ClassId } from "@/lib/pupitre/classes";
import type { RuneEdition, RuneFamilyId, RuneGrade } from "@/lib/pupitre/runes";

export type ServerMode = "classique" | "mono";
export type DeskTab = "tour" | "roue" | "runes" | "textes";
export type PulseKind = "turn" | "trade" | "invite" | "pm";

export type Character = {
  id: string;
  name: string;
  classId: ClassId;
};

export type JournalEntry = {
  id: string;
  at: number;
  kind: PulseKind;
  characterId: string;
  name: string;
};

export type QuickText = {
  id: string;
  label: string;
  body: string;
};

export type RoutePin = {
  id: string;
  place: string;
  done: string[];
};

type PupitreState = {
  mode: ServerMode;
  tab: DeskTab;
  characters: Character[];
  focusId: string | null;
  journal: JournalEntry[];
  texts: QuickText[];
  pins: RoutePin[];
  edition: RuneEdition;
  family: "all" | RuneFamilyId;
  query: string;
  handId: string;
  grade: RuneGrade;
  sink: string;
  setMode: (mode: ServerMode) => void;
  setTab: (tab: DeskTab) => void;
  addCharacter: (name: string, classId: ClassId) => void;
  removeCharacter: (id: string) => void;
  moveCharacter: (id: string, direction: -1 | 1) => void;
  setFocus: (id: string) => void;
  advance: () => void;
  pulse: (kind: Exclude<PulseKind, "turn">) => void;
  clearJournal: () => void;
  clearTeam: () => void;
  restoreExample: () => void;
  addText: (label: string, body: string) => void;
  updateText: (id: string, patch: Partial<Pick<QuickText, "label" | "body">>) => void;
  removeText: (id: string) => void;
  addPin: (place: string) => void;
  toggleArrival: (pinId: string, characterId: string) => void;
  removePin: (id: string) => void;
  setEdition: (edition: RuneEdition) => void;
  setFamily: (family: PupitreState["family"]) => void;
  setQuery: (query: string) => void;
  setHand: (id: string, grade?: RuneGrade) => void;
  setGrade: (grade: RuneGrade) => void;
  setSink: (sink: string) => void;
};

const EXAMPLE: Character[] = [
  { id: "ex-linea", name: "Linéa", classId: "iop" },
  { id: "ex-brume", name: "Brume", classId: "eniripsa" },
  { id: "ex-cendre", name: "Cendre", classId: "cra" },
  { id: "ex-nacre", name: "Nacre", classId: "forgelance" },
];

const DEFAULT_TEXTS: QuickText[] = [
  { id: "tx-pret", label: "Prêt", body: "pret" },
  { id: "tx-suis", label: "Je suis", body: "je vous suis" },
  { id: "tx-lance", label: "Je lance", body: "je lance" },
  { id: "tx-soin", label: "Soin", body: "need soin" },
  { id: "tx-pause", label: "Pause", body: "pause 1 min" },
  { id: "tx-vente", label: "Vente", body: "vente en cours, mp" },
];

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function nextId(characters: Character[], current: string | null): string | null {
  if (characters.length === 0) return null;
  const index = characters.findIndex((character) => character.id === current);
  const following = characters[(index + 1) % characters.length];
  return following?.id ?? characters[0]?.id ?? null;
}

export const usePupitre = create<PupitreState>()(
  persist(
    (set, get) => ({
      mode: "classique",
      tab: "tour",
      characters: EXAMPLE,
      focusId: EXAMPLE[0]?.id ?? null,
      journal: [],
      texts: DEFAULT_TEXTS,
      pins: [{ id: "pin-exemple", place: "Zaap, coin de la place", done: [] }],
      edition: "unity",
      family: "all",
      query: "",
      handId: "vita",
      grade: "ra",
      sink: "0",
      setMode: (mode) => set({ mode }),
      setTab: (tab) => set({ tab }),
      addCharacter: (name, classId) => {
        const trimmed = name.trim().slice(0, 18);
        if (!trimmed) return;
        const character: Character = { id: uid("ch"), name: trimmed, classId };
        set((state) => ({
          characters: [...state.characters, character],
          focusId: state.focusId ?? character.id,
        }));
      },
      removeCharacter: (id) =>
        set((state) => {
          const characters = state.characters.filter((character) => character.id !== id);
          const focusId =
            state.focusId === id ? (characters[0]?.id ?? null) : state.focusId;
          return {
            characters,
            focusId,
            pins: state.pins.map((pin) => ({
              ...pin,
              done: pin.done.filter((doneId) => doneId !== id),
            })),
          };
        }),
      moveCharacter: (id, direction) =>
        set((state) => {
          const index = state.characters.findIndex((character) => character.id === id);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= state.characters.length) return state;
          const characters = state.characters.slice();
          const [picked] = characters.splice(index, 1);
          if (!picked) return state;
          characters.splice(target, 0, picked);
          return { characters };
        }),
      setFocus: (id) => set({ focusId: id }),
      advance: () => {
        const state = get();
        const focusId = nextId(state.characters, state.focusId);
        const character = state.characters.find((entry) => entry.id === focusId);
        if (!focusId || !character) return;
        const entry: JournalEntry = {
          id: uid("jr"),
          at: Date.now(),
          kind: "turn",
          characterId: focusId,
          name: character.name,
        };
        set({
          focusId,
          journal: [entry, ...state.journal].slice(0, 12),
        });
      },
      pulse: (kind) => {
        const state = get();
        const character = state.characters.find((entry) => entry.id === state.focusId);
        if (!character) return;
        const entry: JournalEntry = {
          id: uid("jr"),
          at: Date.now(),
          kind,
          characterId: character.id,
          name: character.name,
        };
        set({ journal: [entry, ...state.journal].slice(0, 12) });
      },
      clearJournal: () => set({ journal: [] }),
      clearTeam: () => set({ characters: [], focusId: null, pins: [], journal: [] }),
      restoreExample: () =>
        set({
          characters: EXAMPLE,
          focusId: EXAMPLE[0]?.id ?? null,
          pins: [{ id: "pin-exemple", place: "Zaap, coin de la place", done: [] }],
        }),
      addText: (label, body) => {
        const trimmedLabel = label.trim().slice(0, 24);
        const trimmedBody = body.trim().slice(0, 180);
        if (!trimmedLabel || !trimmedBody) return;
        set((state) => ({
          texts: [...state.texts, { id: uid("tx"), label: trimmedLabel, body: trimmedBody }],
        }));
      },
      updateText: (id, patch) =>
        set((state) => ({
          texts: state.texts.map((text) => (text.id === id ? { ...text, ...patch } : text)),
        })),
      removeText: (id) =>
        set((state) => ({ texts: state.texts.filter((text) => text.id !== id) })),
      addPin: (place) => {
        const trimmed = place.trim().slice(0, 48);
        if (!trimmed) return;
        set((state) => ({
          pins: [...state.pins, { id: uid("pin"), place: trimmed, done: [] }],
        }));
      },
      toggleArrival: (pinId, characterId) =>
        set((state) => ({
          pins: state.pins.map((pin) => {
            if (pin.id !== pinId) return pin;
            const done = pin.done.includes(characterId)
              ? pin.done.filter((id) => id !== characterId)
              : [...pin.done, characterId];
            return { ...pin, done };
          }),
        })),
      removePin: (id) => set((state) => ({ pins: state.pins.filter((pin) => pin.id !== id) })),
      setEdition: (edition) => set({ edition, handId: edition === "unity" ? "vita" : "vita" }),
      setFamily: (family) => set({ family }),
      setQuery: (query) => set({ query }),
      setHand: (id, grade) => set({ handId: id, grade: grade ?? "rune" }),
      setGrade: (grade) => set({ grade }),
      setSink: (sink) => set({ sink: sink.replace(/[^\d.,]/g, "").slice(0, 8) }),
    }),
    {
      name: "pupitre-dofus3",
      skipHydration: true,
      partialize: (state) => ({
        mode: state.mode,
        characters: state.characters,
        focusId: state.focusId,
        journal: state.journal,
        texts: state.texts,
        pins: state.pins,
        edition: state.edition,
        handId: state.handId,
        grade: state.grade,
        sink: state.sink,
      }),
    },
  ),
);
