const { execFile, spawn } = require("node:child_process");
const dns = require("node:dns").promises;
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { FrameStream, toJson } = require("./decode.cjs");
const { createFightTracker } = require("./fights.cjs");
const { codesHealth } = require("./known-types.cjs");
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

function listInterfaces(tshark) {
  return new Promise((resolve, reject) => {
    execFile(tshark, ["-D"], { windowsHide: true, timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr || error.message).trim()));
        return;
      }
      const ids = [];
      for (const line of stdout.split(/\r?\n/)) {
        const match = /^\d+\.\s+(\S+)/.exec(line.trim());
        if (match && !SKIPPED_INTERFACES.test(line)) ids.push(match[1]);
      }
      resolve(ids);
    });
  });
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
  constructor({ capturesDir, onState, onEvent, ownFighterIds = [], onOwnFighters }) {
    this.capturesDir = capturesDir;
    this.onState = onState;
    this.onEvent = onEvent;
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
    this.capture = null;
    this.status = "idle";
    this.detail = "";
    this.interfaces = [];
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

  async start() {
    if (this.child) return;
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
    try {
      const replay = process.env.PUPITRE_PCAP;
      if (replay) {
        this.interfaces = [path.basename(replay)];
        args = ["-r", replay, "-n", "-Y", "tcp.len > 0 && (tcp.port == 5555 || tcp.port == 443)"];
      } else {
        const [interfaces, addresses] = await Promise.all([listInterfaces(tshark), serverAddresses()]);
        if (interfaces.length === 0) throw new Error("Aucune carte réseau utilisable. Npcap est-il installé ?");
        this.interfaces = interfaces;
        args = ["-l", "-n", ...interfaces.flatMap((id) => ["-i", id]), "-f", captureFilter(addresses), "-Y", "tcp.len > 0"];
      }
    } catch (error) {
      this.setStatus("error", error instanceof Error ? error.message : String(error));
      return;
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
  }

  stop() {
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
    const payload = Buffer.from(hex.replace(/:/g, ""), "hex");
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

  snapshot() {
    const types = [...this.types.values()].sort((a, b) => b.count - a.count).slice(0, TYPES_SHOWN);
    return {
      status: this.status,
      detail: this.detail,
      interfaces: this.interfaces.length,
      startedAt: this.startedAt,
      lastMessageAt: this.lastMessageAt,
      ...this.counters,
      distinctTypes: this.types.size,
      types,
      recent: [...this.recent].reverse(),
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
    };
  }

  forgetOwnFighters() {
    this.fights.forgetOwn();
    this.flush();
  }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.onState?.(this.snapshot());
  }
}

module.exports = { GameNetReader, captureFilter, findTshark };
