import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ClassId } from "@/lib/pupitre/classes";
import {
  digitsOnly,
  EMPTY_FARM,
  parseKamas,
  elapsedMs,
  snapshot,
  type FarmResource,
  type FightLogEntry,
  type FarmSession,
  type FarmSnapshot,
} from "@/lib/pupitre/farm";

export type ServerMode = "classique" | "mono";
export type DeskTab = "tour" | "roue" | "textes" | "reseau";
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

export type FightLootItem = { itemId: number; quantity: number };

const FIGHT_LOG_SIZE = 10;

export type FarmHistoryEntry = FarmSnapshot & {
  id: string;
  zone: string;
  notes: string;
  startedAt: number | null;
  endedAt: number;
  combats: number;
  donjons: number;
};

type PupitreState = {
  mode: ServerMode;
  tab: DeskTab;
  characters: Character[];
  focusId: string | null;
  journal: JournalEntry[];
  texts: QuickText[];
  pins: RoutePin[];
  farm: FarmSession;
  farmHistory: FarmHistoryEntry[];
  autoCombats: boolean;
  setAutoCombats: (autoCombats: boolean) => void;
  autoLoot: boolean;
  setAutoLoot: (autoLoot: boolean) => void;
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
  patchFarm: (patch: Partial<Pick<FarmSession, "zone" | "notes" | "keys" | "other" | "jackpot">>) => void;
  startFarm: () => void;
  pauseFarm: () => void;
  finishFarm: () => void;
  addCombat: () => void;
  addDonjon: () => void;
  addResource: () => void;
  addFightLoot: (kamas: number, items: FightLootItem[]) => string[];
  undoFightLoot: (id: string) => void;
  patchResource: (
    id: string,
    patch: Partial<Pick<FarmResource, "name" | "qty" | "price" | "itemId" | "icon" | "typeName" | "level">>,
  ) => void;
  removeResource: (id: string) => void;
  removeFarmHistory: (id: string) => void;
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

function clearedResources(resources: FarmResource[]): FarmResource[] {
  return resources.map((resource) => ({ ...resource, qty: "" }));
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
      farm: EMPTY_FARM,
      farmHistory: [],
      autoCombats: true,
      setAutoCombats: (autoCombats) => set({ autoCombats }),
      autoLoot: true,
      setAutoLoot: (autoLoot) => set({ autoLoot }),
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
      patchFarm: (patch) =>
        set((state) => ({
          farm: {
            ...state.farm,
            ...patch,
            keys: patch.keys !== undefined ? digitsOnly(patch.keys) : state.farm.keys,
            other: patch.other !== undefined ? digitsOnly(patch.other) : state.farm.other,
            jackpot: patch.jackpot !== undefined ? digitsOnly(patch.jackpot) : state.farm.jackpot,
            zone: patch.zone !== undefined ? patch.zone.slice(0, 48) : state.farm.zone,
            notes: patch.notes !== undefined ? patch.notes.slice(0, 180) : state.farm.notes,
          },
        })),
      startFarm: () =>
        set((state) => {
          const now = Date.now();
          if (state.farm.status === "running") return state;
          if (state.farm.status === "paused") {
            return {
              farm: { ...state.farm, status: "running", segmentStartedAt: now },
            };
          }
          const fresh = state.farm.status === "done";
          return {
            farm: {
              ...state.farm,
              status: "running",
              startedAt: now,
              segmentStartedAt: now,
              accumulatedMs: 0,
              combats: fresh ? 0 : state.farm.combats,
              donjons: fresh ? 0 : state.farm.donjons,
              kamas: fresh ? 0 : (state.farm.kamas ?? 0),
              jackpot: fresh ? "" : state.farm.jackpot,
              resources: fresh ? clearedResources(state.farm.resources) : state.farm.resources,
              fightLog: fresh ? [] : (state.farm.fightLog ?? []),
            },
          };
        }),
      pauseFarm: () =>
        set((state) => {
          if (state.farm.status !== "running" || state.farm.segmentStartedAt === null) return state;
          return {
            farm: {
              ...state.farm,
              status: "paused",
              accumulatedMs: elapsedMs(state.farm, Date.now()),
              segmentStartedAt: null,
            },
          };
        }),
      finishFarm: () =>
        set((state) => {
          if (state.farm.status !== "running" && state.farm.status !== "paused") return state;
          const endedAt = Date.now();
          const elapsed = elapsedMs(state.farm, endedAt);
          const totals = snapshot(state.farm, elapsed);
          const entry: FarmHistoryEntry = {
            id: uid("farm"),
            zone: state.farm.zone.trim() || "Sans zone",
            notes: state.farm.notes.trim(),
            startedAt: state.farm.startedAt,
            endedAt,
            combats: state.farm.combats,
            donjons: state.farm.donjons,
            ...totals,
          };
          return {
            farm: {
              ...state.farm,
              status: "done",
              accumulatedMs: elapsed,
              segmentStartedAt: null,
            },
            farmHistory: [entry, ...state.farmHistory].slice(0, 40),
          };
        }),
      addCombat: () =>
        set((state) => {
          if (state.farm.status !== "running" && state.farm.status !== "paused") return state;
          return { farm: { ...state.farm, combats: state.farm.combats + 1 } };
        }),
      addDonjon: () =>
        set((state) => {
          if (state.farm.status !== "running" && state.farm.status !== "paused") return state;
          return { farm: { ...state.farm, donjons: state.farm.donjons + 1 } };
        }),
      addResource: () =>
        set((state) => ({
          farm: {
            ...state.farm,
            resources: [
              ...state.farm.resources,
              { id: uid("res"), name: "", qty: "", price: "", itemId: null, icon: "", typeName: "", level: null },
            ],
          },
        })),
      addFightLoot: (kamas, items) => {
        const created: string[] = [];
        set((state) => {
          if (state.farm.status !== "running" && state.farm.status !== "paused") return state;
          const resources = [...state.farm.resources];
          for (const { itemId, quantity } of items) {
            const index = resources.findIndex((resource) => resource.itemId === itemId);
            if (index >= 0) {
              const current = resources[index]!;
              resources[index] = { ...current, qty: String(parseKamas(current.qty) + quantity), fromFight: true };
            } else {
              const id = uid("res");
              created.push(id);
              resources.push({
                id,
                name: `Objet ${itemId}`,
                qty: String(quantity),
                price: "",
                itemId,
                icon: "",
                typeName: "",
                level: null,
                fromFight: true,
              });
            }
          }
          const entry: FightLogEntry = { id: uid("fight"), at: Date.now(), kamas, items };
          return {
            farm: {
              ...state.farm,
              kamas: (state.farm.kamas ?? 0) + kamas,
              resources,
              fightLog: [entry, ...(state.farm.fightLog ?? [])].slice(0, FIGHT_LOG_SIZE),
            },
          };
        });
        return created;
      },
      undoFightLoot: (id) =>
        set((state) => {
          const entry = state.farm.fightLog?.find((fight) => fight.id === id);
          if (!entry) return state;
          const resources = state.farm.resources.flatMap((resource) => {
            const taken = entry.items
              .filter((item) => item.itemId === resource.itemId)
              .reduce((sum, item) => sum + item.quantity, 0);
            if (taken === 0) return [resource];
            const left = parseKamas(resource.qty) - taken;
            return left > 0 ? [{ ...resource, qty: String(left) }] : [];
          });
          return {
            farm: {
              ...state.farm,
              kamas: Math.max(0, (state.farm.kamas ?? 0) - entry.kamas),
              resources,
              fightLog: (state.farm.fightLog ?? []).filter((fight) => fight.id !== id),
            },
          };
        }),
      patchResource: (id, patch) =>
        set((state) => ({
          farm: {
            ...state.farm,
            resources: state.farm.resources.map((resource) => {
              if (resource.id !== id) return resource;
              const next: FarmResource = { ...resource };
              if (patch.name !== undefined) {
                next.name = patch.name.slice(0, 72);
                if (patch.itemId === undefined) {
                  next.itemId = null;
                  next.icon = "";
                  next.typeName = "";
                  next.level = null;
                }
              }
              if (patch.qty !== undefined) next.qty = digitsOnly(patch.qty);
              if (patch.price !== undefined) next.price = digitsOnly(patch.price);
              if (patch.itemId !== undefined) next.itemId = patch.itemId;
              if (patch.icon !== undefined) next.icon = patch.icon;
              if (patch.typeName !== undefined) next.typeName = patch.typeName.slice(0, 40);
              if (patch.level !== undefined) next.level = patch.level;
              return next;
            }),
          },
        })),
      removeResource: (id) =>
        set((state) => ({
          farm: {
            ...state.farm,
            resources: state.farm.resources.filter((resource) => resource.id !== id),
          },
        })),
      removeFarmHistory: (id) =>
        set((state) => ({
          farmHistory: state.farmHistory.filter((entry) => entry.id !== id),
        })),
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
        farm: state.farm,
        farmHistory: state.farmHistory,
        autoCombats: state.autoCombats,
        autoLoot: state.autoLoot,
      }),
    },
  ),
);
