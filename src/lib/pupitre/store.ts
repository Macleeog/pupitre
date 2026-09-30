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
import type { OverlaySize, ShortcutAction, ShortcutMap, ShortcutStatus, WantedSighting } from "@/pupitre-desktop";

export type DeskTab = "session" | "reseau" | "reglages";

export type OverlayField = "rate" | "gross" | "kamas" | "items" | "combats" | "donjons";

export const OVERLAY_FIELDS: { id: OverlayField; label: string }[] = [
  { id: "rate", label: "Kamas / heure" },
  { id: "gross", label: "Valeur gagnée" },
  { id: "kamas", label: "Kamas des combats" },
  { id: "items", label: "Objets ramassés" },
  { id: "combats", label: "Combats" },
  { id: "donjons", label: "Donjons" },
];

export const DEFAULT_OVERLAY_FIELDS: OverlayField[] = ["rate", "combats"];
export type Character = {
  id: string;
  name: string;
  classId: ClassId;
};

export type FightLootItem = { itemId: number; quantity: number };

export type ResourcePatch = Partial<
  Pick<FarmResource, "name" | "qty" | "price" | "priceFrom" | "itemId" | "icon" | "typeName" | "level">
>;

export type HdvPrice = { unit: number; at: number };

const HDV_PRICES_KEPT = 1000;

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  overlay: "CommandOrControl+Shift+F9",
  start: "CommandOrControl+Shift+F6",
  pause: "CommandOrControl+Shift+F7",
  stop: "CommandOrControl+Shift+F8",
  reset: "CommandOrControl+Shift+F10",
  combat: "CommandOrControl+Shift+F5",
};

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
  tab: DeskTab;
  me: Character | null;
  overlayFields: OverlayField[];
  overlaySize: OverlaySize;
  overlayButtons: boolean;
  toggleOverlayField: (field: OverlayField) => void;
  setOverlaySize: (size: OverlaySize) => void;
  setOverlayButtons: (overlayButtons: boolean) => void;
  farm: FarmSession;
  farmHistory: FarmHistoryEntry[];
  autoCombats: boolean;
  setAutoCombats: (autoCombats: boolean) => void;
  autoLoot: boolean;
  setAutoLoot: (autoLoot: boolean) => void;
  wantedNotices: boolean;
  setWantedNotices: (wantedNotices: boolean) => void;
  lastWanted: WantedSighting | null;
  setLastWanted: (lastWanted: WantedSighting | null) => void;
  shortcuts: ShortcutMap;
  shortcutStatus: Partial<Record<ShortcutAction, ShortcutStatus>>;
  setShortcut: (action: ShortcutAction, accelerator: string) => void;
  resetShortcuts: () => void;
  setShortcutStatus: (status: Partial<Record<ShortcutAction, ShortcutStatus>>) => void;
  setTab: (tab: DeskTab) => void;
  setMe: (name: string, classId: ClassId) => void;
  patchFarm: (patch: Partial<Pick<FarmSession, "zone" | "notes" | "keys" | "other" | "jackpot">>) => void;
  startFarm: () => void;
  pauseFarm: () => void;
  finishFarm: () => void;
  resetFarm: () => void;
  addCombat: () => void;
  addDonjon: () => void;
  addResource: () => void;
  addFightLoot: (kamas: number, items: FightLootItem[]) => string[];
  undoFightLoot: (id: string) => void;
  patchResource: (id: string, patch: ResourcePatch) => void;
  hdvPrices: Record<string, HdvPrice>;
  applyHdvPrices: (prices: { itemId: number; unitPrice: number }[], at: number) => void;
  forgetHdvPrices: () => void;
  removeResource: (id: string) => void;
  removeFarmHistory: (id: string) => void;
};

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function clearedResources(resources: FarmResource[]): FarmResource[] {
  return resources.map((resource) => ({ ...resource, qty: "" }));
}

export const usePupitre = create<PupitreState>()(
  persist(
    (set) => ({
      tab: "session",
      me: null,
      overlayFields: DEFAULT_OVERLAY_FIELDS,
      overlaySize: "compact",
      overlayButtons: true,
      toggleOverlayField: (field) =>
        set((state) => ({
          overlayFields: state.overlayFields.includes(field)
            ? state.overlayFields.filter((entry) => entry !== field)
            : OVERLAY_FIELDS.map((entry) => entry.id).filter(
                (id) => id === field || state.overlayFields.includes(id),
              ),
        })),
      setOverlaySize: (overlaySize) => set({ overlaySize }),
      setOverlayButtons: (overlayButtons) => set({ overlayButtons }),
      farm: EMPTY_FARM,
      farmHistory: [],
      autoCombats: true,
      setAutoCombats: (autoCombats) => set({ autoCombats }),
      autoLoot: true,
      setAutoLoot: (autoLoot) => set({ autoLoot }),
      wantedNotices: true,
      setWantedNotices: (wantedNotices) => set({ wantedNotices }),
      lastWanted: null,
      setLastWanted: (lastWanted) => set({ lastWanted }),
      shortcuts: DEFAULT_SHORTCUTS,
      shortcutStatus: {},
      setShortcut: (action, accelerator) =>
        set((state) => ({ shortcuts: { ...state.shortcuts, [action]: accelerator.slice(0, 80) } })),
      resetShortcuts: () => set({ shortcuts: DEFAULT_SHORTCUTS }),
      setShortcutStatus: (shortcutStatus) => set({ shortcutStatus }),
      setTab: (tab) => set({ tab }),
      setMe: (name, classId) => {
        const trimmed = name.trim().slice(0, 18);
        if (!trimmed) return;
        set((state) => ({ me: { id: state.me?.id ?? uid("ch"), name: trimmed, classId } }));
      },
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
      resetFarm: () =>
        set((state) => {
          const now = Date.now();
          const running = state.farm.status === "running";
          const paused = state.farm.status === "paused";
          return {
            farm: {
              ...state.farm,
              status: running ? "running" : paused ? "paused" : "idle",
              startedAt: running || paused ? now : null,
              segmentStartedAt: running ? now : null,
              accumulatedMs: 0,
              combats: 0,
              donjons: 0,
              kamas: 0,
              jackpot: "",
              resources: clearedResources(state.farm.resources),
              fightLog: [],
            },
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
              const known = state.hdvPrices[itemId];
              created.push(id);
              resources.push({
                id,
                name: `Objet ${itemId}`,
                qty: String(quantity),
                price: known ? String(known.unit) : "",
                priceFrom: known ? "hdv" : undefined,
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
              if (patch.price !== undefined) {
                next.price = digitsOnly(patch.price);
                next.priceFrom = next.price ? (patch.priceFrom ?? "manual") : undefined;
              }
              if (patch.itemId !== undefined) next.itemId = patch.itemId;
              if (patch.icon !== undefined) next.icon = patch.icon;
              if (patch.typeName !== undefined) next.typeName = patch.typeName.slice(0, 40);
              if (patch.level !== undefined) next.level = patch.level;
              return next;
            }),
          },
        })),
      hdvPrices: {},
      applyHdvPrices: (prices, at) =>
        set((state) => {
          if (prices.length === 0) return state;
          const fresh = Object.fromEntries(prices.map(({ itemId, unitPrice }) => [itemId, { unit: unitPrice, at }]));
          const pricesChanged = prices.some(({ itemId, unitPrice }) => state.hdvPrices[itemId]?.unit !== unitPrice);
          const resources = state.farm.resources.map((resource) => {
            const known = resource.itemId != null ? fresh[resource.itemId] : undefined;
            if (!known || resource.priceFrom === "manual") return resource;
            const price = String(known.unit);
            if (resource.price === price && resource.priceFrom === "hdv") return resource;
            return { ...resource, price, priceFrom: "hdv" as const };
          });
          const resourcesChanged = resources.some((resource, index) => resource !== state.farm.resources[index]);
          if (!pricesChanged && !resourcesChanged) return state;
          const hdvPrices = pricesChanged
            ? Object.fromEntries(
                Object.entries({ ...state.hdvPrices, ...fresh })
                  .sort(([, a], [, b]) => b.at - a.at)
                  .slice(0, HDV_PRICES_KEPT),
              )
            : state.hdvPrices;
          return { hdvPrices, farm: resourcesChanged ? { ...state.farm, resources } : state.farm };
        }),
      forgetHdvPrices: () => set({ hdvPrices: {} }),
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
        me: state.me,
        overlayFields: state.overlayFields,
        overlaySize: state.overlaySize,
        overlayButtons: state.overlayButtons,
        farm: state.farm,
        farmHistory: state.farmHistory,
        autoCombats: state.autoCombats,
        autoLoot: state.autoLoot,
        wantedNotices: state.wantedNotices,
        shortcuts: state.shortcuts,
        hdvPrices: state.hdvPrices,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PupitreState> & {
          characters?: Character[];
          focusId?: string | null;
        };
        const { characters, focusId, ...rest } = saved;
        // Before 0.1.12 the desk kept a team; the character in front becomes "me".
        const mine = characters?.filter((character) => !character.id.startsWith("ex-")) ?? [];
        const me =
          saved.me !== undefined
            ? saved.me
            : (mine.find((character) => character.id === focusId) ?? mine[0] ?? null);
        return {
          ...current,
          ...rest,
          me,
          shortcuts: { ...DEFAULT_SHORTCUTS, ...saved.shortcuts },
          wantedNotices: saved.wantedNotices !== false,
          lastWanted: null,
        };
      },
    },
  ),
);
