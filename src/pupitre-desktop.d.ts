import type { CombatSnapshot } from "@/lib/pupitre/combat-bridge";

export type FarmCommand = "start" | "pause" | "stop" | "reset" | "combat";

export type ShortcutAction = "overlay" | FarmCommand;

export type ShortcutMap = Record<ShortcutAction, string>;

export type ShortcutStatus = "ok" | "empty" | "duplicate" | "failed";

export type NetStatus = "idle" | "unsupported" | "missing" | "starting" | "listening" | "stopped" | "error";

export type NetDirection = "in" | "out";

export type FightResult = {
  fighterId: string;
  xp: number;
  kamas: number;
  items: { itemId: number; quantity: number }[];
  mine?: boolean;
};

export type FightEnd = Extract<FightEvent, { type: "fight-end" }>;

export type FightEvent =
  | { type: "fight-start"; fighters: number; at: number }
  | { type: "fight-end"; at: number; durationMs?: number; results?: FightResult[]; ownFighterIds?: string[] }
  | { type: "turn-start" | "turn-end"; fighterId: string; at: number };

export type HarebourgFighter = {
  id: string;
  name: string | null;
  cell: number | null;
  life: number | null;
  lifeMax: number | null;
  melee: number;
  rotation: string | null;
  aim: string | null;
  aimCell: number | null;
};

export type HarebourgState = {
  type: "harebourg-state";
  at: number;
  active: boolean;
  gfxId: number;
  comteCell: number | null;
  followedId: string | null;
  unidentified: boolean;
  fighters: HarebourgFighter[];
  gap: { id: string; had: number; from: number; to: number } | null;
  mark: { cell: number; x: number; y: number; name: string | null } | null;
  dofusWindow: { x: number; y: number; width: number; height: number } | null;
};

export type WantedMonster = {
  id: number;
  name: string;
  level?: number;
  gfxId?: number;
  kind?: "archi" | "wanted";
};

export type WantedCoords = { x: number; y: number; world?: number };

export type WantedSighting = {
  type: "wanted-sighting";
  at: number;
  mapId: number | null;
  coords?: WantedCoords | null;
  monsters: WantedMonster[];
  text: string;
};

export type GameEvent =
  | FightEvent
  | { type: "hdv-prices"; at: number; source: "sale"; prices: { itemId: number; unitPrice: number }[] }
  | HarebourgState
  | WantedSighting
  | { type: "wanted-absent"; at: number };

export type NetState = {
  status: NetStatus;
  detail: string;
  interfaces: number;
  startedAt: number | null;
  lastMessageAt: number | null;
  packets: number;
  frames: number;
  messages: number;
  bytes: number;
  distinctTypes: number;
  types: { type: string; count: number; in: number; out: number; lastAt: number; kind: string }[];
  recent: { at: number; direction: NetDirection; kind: string; type: string; size: number }[];
  capture: { active: boolean; file: string | null; count: number; startedAt: number | null };
  capturesDir: string;
  inFight: boolean;
  lastFightEvent: FightEvent | null;
  lastFightEnd: FightEnd | null;
  fightsSeen: number;
  ownFighterIds?: string[];
  codes?: { state: "ok" | "unknown" | "stale"; knownShare: number | null };
  lastMarket?: { at: number; source: "sale"; items: number } | null;
  lastWanted?: WantedSighting | null;
  harebourg?: HarebourgState | null;
};

export type OverlaySize = "compact" | "large";

export type UpdateStatus = "idle" | "dev" | "manual" | "checking" | "up-to-date" | "downloading" | "ready" | "error";

export type UpdateState = {
  status: UpdateStatus;
  version: string;
  available: string | null;
  progress: number;
  detail: string;
};

declare global {
  interface Window {
    pupitre?: {
      onFarmCommand: (handler: (command: FarmCommand) => void) => () => void;
      onCombatUpdate?: (fn: (snapshot: CombatSnapshot) => void) => () => void;
      sendCombatSnapshot?: (snapshot: CombatSnapshot) => void;
      overlayMoveBy?: (dx: number, dy: number) => void;
      overlayDragEnd?: () => void;
      copyTravel?: (command: string) => void;
      harebourg?: {
        setEnabled: (enabled: boolean) => void;
      };
      toast?: {
        setCount: (count: number) => void;
        moveBy: (dx: number, dy: number) => void;
        dragEnd: () => void;
        onCoords: (handler: (coords: WantedCoords | null) => void) => () => void;
      };
      shortcuts?: {
        set: (map: ShortcutMap) => Promise<Record<ShortcutAction, ShortcutStatus>>;
      };
      overlaySize?: {
        get: () => Promise<OverlaySize | null>;
        set: (size: OverlaySize) => void;
      };
      updates?: {
        getState: () => Promise<UpdateState | null>;
        check: () => Promise<UpdateState | null>;
        install: () => void;
        onState: (handler: (state: UpdateState) => void) => () => void;
      };
      net?: {
        getState: () => Promise<NetState | null>;
        startCapture: () => Promise<string | null>;
        stopCapture: () => Promise<{ file: string; count: number } | null>;
        restart: () => Promise<NetState | null>;
        openFolder: () => Promise<void>;
        forgetOwn: () => Promise<NetState | null>;
        setActive?: (active: boolean) => void;
        setWantedNotices?: (enabled: boolean) => void;
        setArchiNotices?: (enabled: boolean) => void;
        onState: (handler: (state: NetState) => void) => () => void;
        onGameEvent: (handler: (event: GameEvent) => void) => () => void;
      };
    };
  }
}

export {};
