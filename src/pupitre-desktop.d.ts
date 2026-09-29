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

export type FightEnd = Extract<GameEvent, { type: "fight-end" }>;

export type GameEvent =
  | { type: "fight-start"; fighters: number; at: number }
  | { type: "fight-end"; at: number; durationMs?: number; results?: FightResult[]; ownFighterIds?: string[] }
  | { type: "turn-start" | "turn-end"; fighterId: string; at: number };

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
  lastFightEvent: GameEvent | null;
  lastFightEnd: FightEnd | null;
  fightsSeen: number;
  ownFighterIds?: string[];
  codes?: { state: "ok" | "unknown" | "stale"; knownShare: number | null };
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
      overlayMoveBy?: (dx: number, dy: number) => void;
      overlayDragEnd?: () => void;
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
        onState: (handler: (state: NetState) => void) => () => void;
        onGameEvent: (handler: (event: GameEvent) => void) => () => void;
      };
    };
  }
}

export {};
