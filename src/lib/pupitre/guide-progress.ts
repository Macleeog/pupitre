const KEY = "pupitre-guide-progress-v1";

export type DoneMap = Record<string, true>;

export function loadDone(): DoneMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "") as { done?: DoneMap };
    if (!parsed.done || typeof parsed.done !== "object") return {};
    const done: DoneMap = {};
    for (const [id, value] of Object.entries(parsed.done)) {
      if (value === true && /^\d+$/.test(id)) done[id] = true;
    }
    return done;
  } catch {
    return {};
  }
}

export function saveDone(done: DoneMap) {
  window.localStorage.setItem(KEY, JSON.stringify({ done }));
}

export function withQuestDone(done: DoneMap, questId: number, checked: boolean): DoneMap {
  const key = String(questId);
  const next = { ...done };
  if (checked) next[key] = true;
  else delete next[key];
  return next;
}
