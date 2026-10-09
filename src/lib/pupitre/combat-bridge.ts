export interface FighterState {
  id: string;
  cellId: number | null;
  team?: number | null;
}

export interface CombatSnapshot {
  fightId: string | null;
  fighters: FighterState[];
  selectedCellId: number | null;
  currentTurn: number | null;
}

let snapshot: CombatSnapshot = {
  fightId: null,
  fighters: [],
  selectedCellId: null,
  currentTurn: null,
};

let listeners: ((s: CombatSnapshot) => void)[] = [];

export function subscribeCombat(fn: (s: CombatSnapshot) => void) {
  listeners.push(fn);
  fn(snapshot);
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
}

export function setCombatSnapshot(next: CombatSnapshot) {
  snapshot = next;
  for (const fn of listeners) fn(snapshot);
}

export function getCombatSnapshot() {
  return snapshot;
}
