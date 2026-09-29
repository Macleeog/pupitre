// pupitre-sniffer.cjs - Dofus 3 : capture PASSIVE (lecture seule) -> NDJSON
// Prerequis : Wireshark (inclut Npcap + tshark). Aucune dependance npm. Node >= 18.
// Usage : node pupitre-sniffer.cjs --iface "Wi-Fi" --port 5555 [--out messages.ndjson]
//         node pupitre-sniffer.cjs --pcap packet-jeu.pcapng --port 5555
// Trame observee : [longueur varint][message protobuf]. Le flux n'est pas chiffre.
// Ne genere ni n'injecte aucun paquet.
// Limite : la capture doit demarrer AVANT la connexion au serveur de jeu (sinon le
// decoupage en trames est desynchronise jusqu'a la prochaine connexion).
const { spawn } = require("node:child_process");
const { createWriteStream } = require("node:fs");
const { createInterface } = require("node:readline");

function readVarint(buf, pos) {
  let result = 0n, shift = 0n;
  for (let i = pos; i < buf.length; i++) {
    const b = buf[i];
    result |= BigInt(b & 0x7f) << shift;
    if (!(b & 0x80)) return { value: result, next: i + 1 };
    shift += 7n;
    if (shift > 70n) throw new Error("varint trop long");
  }
  return null;
}

const utf8 = new TextDecoder("utf-8", { fatal: true });
const looksText = (b) => {
  try {
    const s = utf8.decode(b);
    return /^[\P{C}\n\t]*$/u.test(s) && s.length > 0 ? s : null;
  } catch {
    return null;
  }
};

// Decodage protobuf generique (sans schema) : { "<champ>": [valeurs] }
function decodeFields(buf, depth = 0) {
  const out = {};
  let pos = 0;
  while (pos < buf.length) {
    const tag = readVarint(buf, pos);
    if (!tag) return null;
    pos = tag.next;
    const field = Number(tag.value >> 3n), wt = Number(tag.value & 7n);
    let val;
    if (wt === 0) {
      const v = readVarint(buf, pos);
      if (!v) return null;
      pos = v.next;
      val = BigInt.asIntN(64, v.value);
      val = val >= -(2n ** 31n) && val < 2n ** 31n ? Number(val) : val.toString();
    } else if (wt === 1) {
      if (pos + 8 > buf.length) return null;
      val = { fixed64: Buffer.from(buf.subarray(pos, pos + 8)).toString("hex") };
      pos += 8;
    } else if (wt === 5) {
      if (pos + 4 > buf.length) return null;
      val = { fixed32: buf.readUInt32LE(pos) };
      pos += 4;
    } else if (wt === 2) {
      const l = readVarint(buf, pos);
      if (!l) return null;
      const end = l.next + Number(l.value);
      if (end > buf.length) return null;
      const sub = buf.subarray(l.next, end);
      pos = end;
      const nested = depth < 8 && sub.length ? decodeFields(sub, depth + 1) : null;
      const text = looksText(sub);
      val =
        text !== null && (nested === null || (/[ \p{L}]{3,}/u.test(text) && !/^[\x00-\x1f]/.test(text)))
          ? text
          : nested ?? { bytes: Buffer.from(sub).toString("base64") };
    } else return null;
    (out[field] ??= []).push(val);
  }
  return out;
}

// Enveloppe deduite de la capture (a valider avec plus d'echantillons) :
//  champ 1 = requete client    { 1: Any, 2: uid }
//  champ 2 = evenement serveur { 3: Any }
//  champ 3 = reponse           { 1: Any, 2: uid }      ; Any = { 1: typeUrl, 2: octets }
function interpret(msg) {
  const top = decodeFields(msg);
  if (!top) return { kind: "unknown", uid: -1, wireType: null, typeUrl: null, payload: null, rawAny: null, unknown: true };
  const one = (v) => (Array.isArray(v) ? v[0] : v);
  let kind = "unknown", any, uid = -1;
  if (top[1]) { kind = "request"; const r = one(top[1]); any = one(r?.[1]); uid = one(r?.[2]) ?? -1; }
  else if (top[2]) { kind = "event"; const r = one(top[2]); any = one(r?.[3]); }
  else if (top[3]) { kind = "response"; const r = one(top[3]); any = one(r?.[1]); uid = one(r?.[2]) ?? -1; }
  const wireType = any?.[1] ? String(one(any[1])).replace("type.ankama.com/", "") : null;
  return {
    kind,
    uid,
    wireType,
    typeUrl: wireType ? `type.ankama.com/${wireType}` : null,
    payload: any?.[2] ? one(any[2]) : null,
    rawAny: any?.[2]?.[0]?.bytes ?? null,
    unknown: kind === "unknown" || !wireType,
  };
}

// Reassemblage TCP par sens (numeros de sequence) + decoupage varint
class FrameStream {
  constructor() { this.next = null; this.pending = new Map(); this.buf = Buffer.alloc(0); }
  push(seq, data) {
    if (this.next === null) this.next = seq;
    const delta = (this.next - seq) >>> 0;
    if (delta > 0 && delta < 0x80000000) {
      if (delta >= data.length) return [];
      data = data.subarray(delta);
      seq = this.next;
    }
    this.pending.set(seq, data);
    while (this.pending.has(this.next)) {
      const c = this.pending.get(this.next);
      this.pending.delete(this.next);
      this.buf = Buffer.concat([this.buf, c]);
      this.next = (this.next + c.length) >>> 0;
    }
    if (this.pending.size > 256) { this.pending.clear(); this.next = null; this.buf = Buffer.alloc(0); }
    const frames = [];
    for (;;) {
      const l = readVarint(this.buf, 0);
      if (!l) break;
      const len = Number(l.value);
      if (len > 8 * 1024 * 1024) { this.buf = Buffer.alloc(0); break; }
      if (this.buf.length < l.next + len) break;
      frames.push(this.buf.subarray(l.next, l.next + len));
      this.buf = this.buf.subarray(l.next + len);
    }
    return frames;
  }
}

function main() {
  const a = process.argv.slice(2);
  const arg = (n, d) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : d; };
  const port = arg("--port", "5555"), iface = arg("--iface", "Wi-Fi"), pcap = arg("--pcap"), outFile = arg("--out");
  const tshark = arg("--tshark", "C:\\Program Files\\Wireshark\\tshark.exe");
  const fields = ["-T", "fields", "-e", "frame.time_epoch", "-e", "tcp.srcport", "-e", "tcp.stream", "-e", "tcp.seq_raw", "-e", "tcp.payload"];
  const args = pcap
    ? ["-r", pcap, "-Y", `tcp.port == ${port} && tcp.len > 0`, ...fields]
    : ["-l", "-i", iface, "-f", `tcp port ${port}`, "-Y", "tcp.len > 0", ...fields];
  const out = outFile ? createWriteStream(outFile, { flags: "a" }) : process.stdout;
  const streams = new Map();
  let sequence = 0n;
  const p = spawn(tshark, args, { stdio: ["ignore", "pipe", "inherit"] });
  p.on("error", (e) => { process.stderr.write(`tshark introuvable ou inutilisable: ${e.message}\n`); process.exitCode = 1; });
  createInterface({ input: p.stdout }).on("line", (line) => {
    const [t, sp, sid, seq, hex] = line.split("\t");
    if (!hex) return;
    const inbound = sp === String(port), key = `${sid}:${inbound}`;
    const fs = streams.get(key) ?? streams.set(key, new FrameStream()).get(key);
    for (const f of fs.push(Number(seq), Buffer.from(hex.replace(/:/g, ""), "hex"))) {
      let rec;
      try { rec = interpret(f); } catch { rec = { kind: "unknown", unknown: true }; }
      out.write(JSON.stringify({ sequence: String(++sequence), ts: new Date(Number(t) * 1000).toISOString(), direction: inbound ? "inbound" : "outbound", ...rec }) + "\n");
    }
  });
  p.on("exit", (c) => { if (outFile) out.end(); if (c) process.exitCode = c; });
}

module.exports = { readVarint, decodeFields, interpret, FrameStream };
if (require.main === module) main();
