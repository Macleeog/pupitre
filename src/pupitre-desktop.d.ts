export type FarmCommand = "start" | "pause" | "stop" | "combat";

export type NetStatus = "idle" | "unsupported" | "missing" | "starting" | "listening" | "stopped" | "error";

export type NetDirection = "in" | "out";

export type FightResult = {
  fighterId: string;
  xp: number;
  kamas: number;
  items: { itemId: number; quantity: number }[];
};

export type FightEnd = Extract<GameEvent, { type: "fight-end" }>;

export type GameEvent =
  | { type: "fight-start"; fighters: number; at: number }
  | { type: "fight-end"; at: number; durationMs?: number; results?: FightResult[] }
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
};

declare global {
  interface Window {
    pupitre?: {
      onFarmCommand: (handler: (command: FarmCommand) => void) => () => void;
      overlayMoveBy?: (dx: number, dy: number) => void;
      overlayDragEnd?: () => void;
      net?: {
        getState: () => Promise<NetState | null>;
        startCapture: () => Promise<string | null>;
        stopCapture: () => Promise<{ file: string; count: number } | null>;
        restart: () => Promise<NetState | null>;
        openFolder: () => Promise<void>;
        onState: (handler: (state: NetState) => void) => () => void;
        onGameEvent: (handler: (event: GameEvent) => void) => () => void;
      };
    };
  }
}

export {};
