export type FarmCommand = "start" | "pause" | "stop" | "combat";

declare global {
  interface Window {
    pupitre?: {
      onFarmCommand: (handler: (command: FarmCommand) => void) => () => void;
    };
  }
}

export {};
