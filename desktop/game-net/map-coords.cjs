const fs = require("node:fs");

// The game packet (jpo, field 6) carries the map id. Dofus coordinates are not in that
// packet: DofusDB's map-positions record for the same id has posX and posY, which is
// what /travel expects.
function validCoords(coords) {
  const x = coords?.x;
  const y = coords?.y;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (x < -256 || x > 256 || y < -256 || y > 256) return null;
  return { x, y };
}

function readCache(file) {
  if (!file) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function lookupMapCoords(mapId, { cacheFile = null, fetchImpl = globalThis.fetch, timeoutMs = 2500 } = {}) {
  const id = Number(mapId);
  if (!Number.isInteger(id) || id <= 1000) return null;
  const cache = readCache(cacheFile);
  const cached = validCoords(cache[String(id)]);
  if (cached) return cached;
  if (typeof fetchImpl !== "function") return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`https://api.dofusdb.fr/map-positions/${id}`, { signal: controller.signal });
    if (!response?.ok) return null;
    const body = await response.json();
    const coords = validCoords({ x: body?.posX, y: body?.posY });
    if (!coords) return null;
    if (cacheFile) {
      cache[String(id)] = coords;
      try {
        fs.writeFileSync(cacheFile, JSON.stringify(cache));
      } catch {
        // A missing cache only costs the next lookup.
      }
    }
    return coords;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { lookupMapCoords, validCoords };
