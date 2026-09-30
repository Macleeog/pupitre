const { execFile, spawn } = require("node:child_process");
const dns = require("node:dns").promises;
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { FrameStream, toJson } = require("./decode.cjs");
const { createFightTracker } = require("./fights.cjs");
const { codesHealth } = require("./known-types.cjs");
const { createWantedWatch, sentence } = require("./wanted.cjs");
const { readMarket } = require("./market.cjs");

const GAME_PORTS = new Set([5555, 443]);
const SERVERS = [
  "rafal",
  "brial",
  "hellmina",
  "imagiro",
  "orukam",
  "talkasha",
  "tylezia",
  "salar",
  "dakal",
  "kourial",
  "mikhal",
  "draconiros",
  "ombre",
];
const SKIPPED_INTERFACES = /loopback|etwdump|ciscodump|randpkt|sshdump|udpdump|wifidump|sdjournal|androiddump|dpauxmon/i;
const VIRTUAL_INTERFACE = /virtual|vmware|vbox|hyper-?v|vethernet|bluetooth|miniport|tunnel|wsl|docker|pseudo|teredo|isatap/i;
const ADDRESS_TTL_MS = 12 * 60 * 60 * 1000;
const IDLE_STOP_MS = 5000;
const STREAM_TTL_MS = 3 * 60 * 1000;
const MAX_STREAMS = 64;
const RECENT = 40;
const TYPES_SHOWN = 30;

function findTshark() {
  const candidates = [
    process.env.PUPITRE_TSHARK,
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Wireshark", "tshark.exe"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Wireshark", "tshark.exe"),
    "C:\\Program Files\\Wireshark\\tshark.exe",
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;
}

function describeInterfaces(stdout) {
  const listed = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^\d+\.\s+(\S+)(?:\s+\((.*)\))?/.exec(line.trim());
    if (!match || SKIPPED_INTERFACES.test(line)) continue;
    const name = `${match[2] ?? ""} ${match[1]}`;
    listed.push({ id: match[1], name, virtual: VIRTUAL_INTERFACE.test(name) });
  }
  return listed;
}

// Virtual adapters (Hyper-V, WSL, VPN) make tshark decode traffic that is not the game's.
// When every adapter looks virtual, keep them all so a capture still happens.
function pickInterfaces(listed) {
  const real = listed.filter((item) => !item.virtual);
  return (real.length > 0 ? real : listed).map((item) => item.id);
}

function listInterfaces(tshark) {
  return new Promise((resolve, reject) => {
    execFile(tshark, ["-D"], { windowsHide: true, timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr || error.message).trim()));
        return;
      }
      resolve(describeInterfaces(stdout));
    });
  });
}

function readAddressCache(file) {
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(saved.addresses) || saved.addresses.length === 0 || Date.now() - Number(saved.at) > ADDRESS_TTL_MS) {
      return null;
    }
    if (!saved.addresses.every((address) => typeof address === "string" && /^\d{1,3}(?:\.\d{1,3}){3}$/.test(address))) {
      return null;
    }
    return saved.addresses;
  } catch {
    return null;
  }
}

function writeAddressCache(file, addresses) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ at: Date.now(), addresses }));
  } catch {
    // The next launch resolves the names again.
  }
}

const HEX_VALUE = new Int8Array(128).fill(-1);
for (let i = 0; i < 10; i++) HEX_VALUE[48 + i] = i;
for (let i = 0; i < 6; i++) {
  HEX_VALUE[65 + i] = 10 + i;
  HEX_VALUE[97 + i] = 10 + i;
}

function payloadFromHex(hex) {
  let digits = 0;
  for (let i = 0; i < hex.length; i++) if (hex.charCodeAt(i) !== 58) digits++;
  const out = Buffer.allocUnsafe(digits >> 1);
  let written = 0;
  for (let i = 0; i < hex.length; ) {
    const code = hex.charCodeAt(i);
    if (code === 58) {
      i++;
      continue;
    }
    const hi = code < 128 ? HEX_VALUE[code] : -1;
    const lowCode = hex.charCodeAt(i + 1);
    const lo = lowCode < 128 ? HEX_VALUE[lowCode] : -1;
    if (hi < 0 || lo < 0) return null;
    out[written++] = (hi << 4) | lo;
    i += 2;
  }
  return written === out.length ? out : out.subarray(0, written);
}

async function serverAddresses() {
  const results = await Promise.allSettled(
    SERVERS.map((name) => dns.resolve4(`dofus2-ga-${name}.ankama-games.com`)),
  );
  return [...new Set(results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])))];
}

function captureFilter(addresses) {
  if (addresses.length === 0) return "tcp port 5555";
  return `tcp and (port 5555 or (port 443 and (${addresses.map((address) => `host ${address}`).join(" or ")})))`;
}

const FIELDS = ["frame.time_epoch", "tcp.srcport", "tcp.stream", "tcp.seq_raw", "tcp.seq", "tcp.payload"];

class GameNetReader {
  constructor({ capturesDir, cacheFile = null, onState, onEvent, ownFighterIds = [], onOwnFighters, mapLookup = null }) {
    this.capturesDir = capturesDir;
    this.cacheFile = cacheFile;
    this.onState = onState;
    this.onEvent = onEvent;
    this.mapLookup = mapLookup;
    this.child = null;
    this.timer = null;
    this.dirty = true;
    this.streams = new Map();
    this.fights = createFightTracker((event) => {
      this.lastFightEvent = event;
      if (event.type === "fight-end") {
        this.lastFightEnd = event;
        this.fightsSeen += 1;
      }
      this.dirty = true;
      this.onEvent?.(event);
    }, {
      ownFighterIds,
      onOwnFighter: (ids) => {
        this.dirty = true;
        onOwnFighters?.(ids);
      },
    });
    this.lastFightEvent = null;
    this.lastFightEnd = null;
    this.fightsSeen = 0;
    this.lastMarket = null;
    this.lastWanted = null;
    this.wantedNotices = true;
    this.archiNotices = true;
    this.wantedToken = null;
    this.wanted = createWantedWatch((event) => {
      if (event.type === "wanted-absent") {
        this.wantedToken = null;
        this.lastWanted = null;
        this.dirty = true;
        this.onEvent?.(event);
        return;
      }
      if (event.type !== "wanted-sighting") return;
      // Both kinds are always detected; the two settings decide which ones are announced.
      const monsters = event.monsters.filter((monster) =>
        monster.kind === "archi" ? this.archiNotices !== false : this.wantedNotices !== false,
      );
      if (monsters.length === 0) return;
      const sighting =
        monsters.length === event.monsters.length ? event : { ...event, monsters, text: sentence(monsters) };
      this.lastWanted = sighting;
      this.dirty = true;
      this.onEvent?.(sighting);
      if (!this.mapLookup || !sighting.mapId) return;
      const token = sighting.at;
      this.wantedToken = token;
      Promise.resolve()
        .then(() => this.mapLookup(sighting.mapId))
        .then((coords) => {
          if (this.wantedToken !== token || !coords) return;
          const next = { ...sighting, coords };
          this.lastWanted = next;
          this.dirty = true;
          this.onEvent?.(next);
        })
        .catch(() => {
          // The alert still stands without coordinates.
        });
    });
    this.capture = null;
    this.status = "idle";
    this.detail = "";
    this.interfaces = [];
    this.activeWanted = false;
    this.starting = false;
    this.idleTimer = null;
    this.resetCounters();
  }

  resetCounters() {
    this.counters = { packets: 0, frames: 0, messages: 0, bytes: 0 };
    this.types = new Map();
    this.recent = [];
    this.startedAt = null;
    this.lastMessageAt = null;
  }

  setStatus(status, detail = "") {
    this.status = status;
    this.detail = detail;
    this.dirty = true;
    this.flush();
  }

  setActive(active) {
    if (active === this.activeWanted) return;
    this.activeWanted = active;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (active) {
      if (!this.child && !this.starting) void this.start();
      return;
    }
    if (!this.child || this.capture) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (!this.activeWanted && this.child && !this.capture) this.suspend();
    }, IDLE_STOP_MS);
  }

  suspend() {
    const child = this.child;
    this.child = null;
    if (child && !child.killed) child.kill();
    this.setStatus("idle", "");
  }

  async start() {
    if (this.child || this.starting) return;
    this.activeWanted = true;
    this.starting = true;
    try {
      if (process.platform !== "win32" && !process.env.PUPITRE_TSHARK) {
        this.setStatus("unsupported", "La lecture du réseau ne fonctionne que dans l'exe Windows.");
        return;
      }
      const tshark = findTshark();
      if (!tshark) {
        this.setStatus("missing", "Wireshark n'est pas installé. Installe-le avec Npcap, puis relance la lecture.");
        return;
      }
      this.setStatus("starting", "Recherche des cartes réseau et des serveurs Dofus…");
      this.timer ??= setInterval(() => this.flush(), 1000);
      let args;
      const replay = process.env.PUPITRE_PCAP;
      if (replay) {
        this.interfaces = [path.basename(replay)];
        args = ["-r", replay, "-n", "-Y", "tcp.len > 0 && (tcp.port == 5555 || tcp.port == 443)"];
      } else {
        const cached = this.cacheFile ? readAddressCache(this.cacheFile) : null;
        const resolving = serverAddresses().then((addresses) => {
          if (addresses.length > 0 && this.cacheFile) writeAddressCache(this.cacheFile, addresses);
          return addresses;
        });
        const [listed, addresses] = await Promise.all([listInterfaces(tshark), cached ? Promise.resolve(cached) : resolving]);
        if (!cached) void resolving;
        const interfaces = pickInterfaces(listed);
        if (interfaces.length === 0) throw new Error("Aucune carte réseau utilisable. Npcap est-il installé ?");
        this.interfaces = interfaces;
        args = ["-l", "-n", ...interfaces.flatMap((id) => ["-i", id]), "-f", captureFilter(addresses), "-Y", "tcp.len > 0"];
      }
      args.push("-T", "fields", "-E", "separator=/t", ...FIELDS.flatMap((field) => ["-e", field]));

      this.resetCounters();
      this.streams.clear();
      this.startedAt = Date.now();
      const child = spawn(tshark, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      this.child = child;
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr = (stderr + String(chunk)).slice(-2000);
      });
      child.on("error", (error) => {
        if (this.child === child) this.child = null;
        this.setStatus("error", error.message);
      });
      child.on("exit", (code) => {
        if (this.child !== child) return;
        this.child = null;
        const reason = stderr.trim().split(/\r?\n/).filter((line) => !/^Capturing on/i.test(line)).at(-1);
        if (process.env.PUPITRE_PCAP && code === 0) this.setStatus("stopped", "Relecture terminée.");
        else this.setStatus("error", reason || `tshark s'est arrêté (code ${code ?? "?"}).`);
      });
      readline.createInterface({ input: child.stdout }).on("line", (line) => this.handleLine(line));
      this.setStatus("listening", "");
      if (!this.activeWanted) this.suspend();
    } catch (error) {
      this.setStatus("error", error instanceof Error ? error.message : String(error));
    } finally {
      this.starting = false;
    }
  }

  stop() {
    this.activeWanted = false;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    const child = this.child;
    this.child = null;
    if (child && !child.killed) child.kill();
    this.stopCapture();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.setStatus("stopped", "Lecture arrêtée.");
  }

  async restart() {
    this.stop();
    await this.start();
  }

  handleLine(line) {
    const [time, sourcePort, stream, seqRaw, seqRelative, hex] = line.split("\t");
    if (!hex) return;
    const seq = Number(seqRaw || seqRelative);
    if (!Number.isFinite(seq)) return;
    const at = Math.round(Number(time) * 1000) || Date.now();
    const inbound = GAME_PORTS.has(Number(sourcePort));
    const key = `${stream}:${inbound ? "in" : "out"}`;
    let frames = this.streams.get(key);
    if (!frames) {
      if (this.streams.size >= MAX_STREAMS) this.streams.delete(this.streams.keys().next().value);
      frames = new FrameStream();
      this.streams.set(key, frames);
    }
    frames.seenAt = Date.now();
    const payload = payloadFromHex(hex);
    if (!payload || payload.length === 0) return;
    this.counters.packets += 1;
    this.counters.bytes += payload.length;
    this.dirty = true;
    for (const { decoded } of frames.push(seq, payload)) {
      this.counters.frames += 1;
      for (const message of decoded.messages) this.record(stream, inbound, decoded.kind, message, at);
    }
  }

  record(stream, inbound, kind, message, at) {
    const direction = inbound ? "in" : "out";
    this.counters.messages += 1;
    this.lastMessageAt = at;
    const type = this.types.get(message.type) ?? { type: message.type, count: 0, in: 0, out: 0, lastAt: 0, kind };
    type.count += 1;
    type[direction] += 1;
    type.lastAt = at;
    this.types.set(message.type, type);
    this.recent.push({ at, direction, kind, type: message.type, size: message.value.length });
    if (this.recent.length > RECENT) this.recent.shift();
    if (this.capture) {
      this.capture.count += 1;
      this.capture.out.write(
        `${JSON.stringify({
          at: new Date(at).toISOString(),
          connection: Number(stream),
          direction,
          kind,
          type: message.type,
          typeUrl: message.typeUrl,
          size: message.value.length,
          fields: toJson(message.value),
        })}\n`,
      );
    }
    try {
      this.fights.handle(stream, message, at, direction);
      this.wanted.handle(message, at);
      const market = inbound ? readMarket(message) : null;
      if (market && market.prices.length > 0) {
        this.lastMarket = { at, source: market.source, items: market.prices.length };
        this.dirty = true;
        this.onEvent?.({ type: "hdv-prices", at, source: market.source, prices: market.prices });
      }
    } catch {
      // A malformed payload must never stop the reader.
    }
  }

  startCapture() {
    if (this.capture) return this.capture.file;
    fs.mkdirSync(this.capturesDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(this.capturesDir, `capture-${stamp}.ndjson`);
    this.capture = { file, count: 0, startedAt: Date.now(), out: fs.createWriteStream(file, { flags: "a" }) };
    this.dirty = true;
    this.flush();
    return file;
  }

  stopCapture() {
    const capture = this.capture;
    if (!capture) return null;
    this.capture = null;
    capture.out.end();
    this.lastCapture = { file: capture.file, count: capture.count };
    this.dirty = true;
    this.flush();
    return this.lastCapture;
  }

  snapshot(brief = false) {
    const types = brief ? [] : [...this.types.values()].sort((a, b) => b.count - a.count).slice(0, TYPES_SHOWN);
    const recent = brief ? [] : [...this.recent].reverse();
    return {
      status: this.status,
      detail: this.detail,
      interfaces: this.interfaces.length,
      startedAt: this.startedAt,
      lastMessageAt: this.lastMessageAt,
      ...this.counters,
      distinctTypes: this.types.size,
      types,
      recent,
      capture: this.capture
        ? { active: true, file: this.capture.file, count: this.capture.count, startedAt: this.capture.startedAt }
        : { active: false, file: this.lastCapture?.file ?? null, count: this.lastCapture?.count ?? 0, startedAt: null },
      capturesDir: this.capturesDir,
      inFight: this.fights.inFight(),
      lastFightEvent: this.lastFightEvent,
      lastFightEnd: this.lastFightEnd,
      fightsSeen: this.fightsSeen,
      ownFighterIds: this.fights.ownFighterIds(),
      codes: codesHealth([...this.types.keys()], this.counters.messages),
      lastMarket: this.lastMarket,
      lastWanted: this.lastWanted,
    };
  }

  forgetOwnFighters() {
    this.fights.forgetOwn();
    this.flush();
  }

  flush() {
    if (this.streams.size > 8) {
      const cutoff = Date.now() - STREAM_TTL_MS;
      for (const [key, frames] of this.streams) {
        if ((frames.seenAt ?? 0) < cutoff) this.streams.delete(key);
      }
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.onState?.(this.snapshot(true));
  }
}

module.exports = { GameNetReader, captureFilter, findTshark, describeInterfaces, pickInterfaces, payloadFromHex };
