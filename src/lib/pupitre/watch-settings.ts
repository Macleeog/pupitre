export type WatchKind = "archi" | "wanted";

export type WatchCoords = { x: number; y: number; world?: number };

export type WatchMonster = {
  id: number;
  name: string;
  gfxId?: number;
  kind?: WatchKind;
};

export type WatchSighting = {
  at: number;
  text: string;
  mapId: number | null;
  coords: WatchCoords | null;
  monsters: WatchMonster[];
};

export type WatchSettings = {
  harebourg: boolean;
  archiNotices: boolean;
  wantedNotices: boolean;
  sightings: WatchSighting[];
};

const KEY = "pupitre-watch-v1";
const MAX_SIGHTINGS = 40;

export function defaultWatchSettings(): WatchSettings {
  return { harebourg: true, archiNotices: true, wantedNotices: true, sightings: [] };
}

function isMonster(value: unknown): value is WatchMonster {
  if (!value || typeof value !== "object") return false;
  const row = value as WatchMonster;
  return typeof row.id === "number" && typeof row.name === "string" && row.name.length > 0;
}

function isSighting(value: unknown): value is WatchSighting {
  if (!value || typeof value !== "object") return false;
  const row = value as WatchSighting;
  return typeof row.at === "number" && typeof row.text === "string" && Array.isArray(row.monsters) && row.monsters.every(isMonster);
}

export function loadWatchSettings(): WatchSettings {
  if (typeof window === "undefined") return defaultWatchSettings();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "") as Partial<WatchSettings>;
    return {
      harebourg: parsed.harebourg !== false,
      archiNotices: parsed.archiNotices !== false,
      wantedNotices: parsed.wantedNotices !== false,
      sightings: Array.isArray(parsed.sightings) ? parsed.sightings.filter(isSighting).slice(0, MAX_SIGHTINGS) : [],
    };
  } catch {
    return defaultWatchSettings();
  }
}

export function saveWatchSettings(settings: WatchSettings) {
  const next = { ...settings, sightings: settings.sightings.slice(0, MAX_SIGHTINGS) };
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("pupitre-watch-settings", { detail: next }));
  const channel = new BroadcastChannel("pupitre-watch-settings");
  channel.postMessage(next);
  channel.close();
}

export function pushWatchSettings(settings: WatchSettings) {
  window.pupitre?.net?.setWantedNotices?.(settings.wantedNotices);
  window.pupitre?.net?.setArchiNotices?.(settings.archiNotices);
  window.pupitre?.harebourg?.setEnabled?.(settings.harebourg);
}

export function readerShouldRun(settings: WatchSettings, farming: boolean, networkTab: boolean) {
  return farming || networkTab || settings.harebourg || settings.archiNotices || settings.wantedNotices;
}

export function travelFor(coords: WatchCoords | null | undefined): string | null {
  if (!coords || !Number.isInteger(coords.x) || !Number.isInteger(coords.y)) return null;
  if (coords.x < -256 || coords.x > 256 || coords.y < -256 || coords.y > 256) return null;
  if (coords.world && coords.world !== 1) return null;
  return `/travel ${coords.x},${coords.y}`;
}

export function otherWorld(coords: WatchCoords | null | undefined) {
  return Boolean(coords && coords.world && coords.world !== 1);
}

export function acceptsMonster(monster: WatchMonster, settings: Pick<WatchSettings, "archiNotices" | "wantedNotices">) {
  if (monster.kind === "archi") return settings.archiNotices;
  return settings.wantedNotices;
}

export function visibleSightings(settings: WatchSettings, now = Date.now(), maxAgeMs = 10 * 60 * 1000) {
  return settings.sightings
    .filter((sighting) => now - sighting.at < maxAgeMs)
    .map((sighting) => ({
      ...sighting,
      monsters: sighting.monsters.filter((monster) => acceptsMonster(monster, settings)),
    }))
    .filter((sighting) => sighting.monsters.length > 0);
}

export function rememberSighting(settings: WatchSettings, sighting: WatchSighting): WatchSettings {
  const without = settings.sightings.filter((entry) => entry.at !== sighting.at || entry.text !== sighting.text);
  return { ...settings, sightings: [sighting, ...without].slice(0, MAX_SIGHTINGS) };
}

export async function copyTravel(command: string) {
  if (!/^\/travel -?\d{1,4},-?\d{1,4}$/.test(command)) return;
  if (window.pupitre?.copyTravel) {
    window.pupitre.copyTravel(command);
    return;
  }
  await navigator.clipboard.writeText(command);
}
