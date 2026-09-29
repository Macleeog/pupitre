// Dofus 3 wire format: [varint length][protobuf envelope]. The envelope wraps one or more
// google.protobuf.Any values whose type_url starts with "type.ankama.com/". Type names are
// short obfuscated codes ("jwe", "kob"...) that Ankama may rename on any game update.

const TYPE_PREFIX = "type.ankama.com/";
const MARKER = Buffer.from(TYPE_PREFIX, "ascii");
const MAX_FRAME = 8 * 1024 * 1024;
const MAX_UNSYNCED_FRAME = 1024 * 1024;
const MAX_DEPTH = 5;

function readVarint(buf, pos) {
  let result = 0n;
  let shift = 0n;
  for (let i = pos; i < buf.length; i++) {
    const byte = buf[i];
    result |= BigInt(byte & 0x7f) << shift;
    if (!(byte & 0x80)) return { value: result, next: i + 1 };
    shift += 7n;
    if (shift > 70n) return null;
  }
  return null;
}

// Strict parse: returns null unless the whole buffer is a well-formed protobuf message.
function parseMessage(buf) {
  const fields = new Map();
  let pos = 0;
  while (pos < buf.length) {
    const tag = readVarint(buf, pos);
    if (!tag) return null;
    pos = tag.next;
    const field = Number(tag.value >> 3n);
    const wireType = Number(tag.value & 7n);
    if (field === 0) return null;
    let entry;
    if (wireType === 0) {
      const value = readVarint(buf, pos);
      if (!value) return null;
      pos = value.next;
      entry = { wireType, value: value.value };
    } else if (wireType === 1) {
      if (pos + 8 > buf.length) return null;
      entry = { wireType, raw: buf.subarray(pos, pos + 8) };
      pos += 8;
    } else if (wireType === 2) {
      const length = readVarint(buf, pos);
      if (!length) return null;
      const end = length.next + Number(length.value);
      if (end > buf.length) return null;
      entry = { wireType, raw: buf.subarray(length.next, end) };
      pos = end;
    } else if (wireType === 5) {
      if (pos + 4 > buf.length) return null;
      entry = { wireType, raw: buf.subarray(pos, pos + 4) };
      pos += 4;
    } else {
      return null;
    }
    const list = fields.get(field);
    if (list) list.push(entry);
    else fields.set(field, [entry]);
  }
  return fields;
}

function asTypeUrl(entry) {
  if (!entry || entry.wireType !== 2 || entry.raw.length <= MARKER.length || entry.raw.length > 128) return null;
  if (!entry.raw.subarray(0, MARKER.length).equals(MARKER)) return null;
  return entry.raw.toString("ascii");
}

function collectAnys(fields, depth, out) {
  for (const entries of fields.values()) {
    for (const entry of entries) {
      if (entry.wireType !== 2 || entry.raw.length === 0) continue;
      const nested = parseMessage(entry.raw);
      if (!nested) continue;
      const typeUrl = asTypeUrl(nested.get(1)?.[0]);
      if (typeUrl) {
        const value = nested.get(2)?.[0];
        out.push({ typeUrl, type: typeUrl.slice(TYPE_PREFIX.length), value: value?.wireType === 2 ? value.raw : Buffer.alloc(0) });
      } else if (depth < MAX_DEPTH) {
        collectAnys(nested, depth + 1, out);
      }
    }
  }
  return out;
}

const KINDS = { 1: "request", 2: "event", 3: "response" };

// Returns null when the frame is not a Dofus envelope (used to detect lost framing).
function decodeFrame(frame) {
  const top = parseMessage(frame);
  if (!top) return null;
  const messages = collectAnys(top, 0, []);
  if (messages.length === 0) return null;
  const kind = KINDS[[...top.keys()][0]] ?? "unknown";
  return { kind, messages };
}

function varintField(fields, field) {
  const entry = fields?.get(field)?.[0];
  return entry?.wireType === 0 ? entry.value : undefined;
}

function messageField(fields, field) {
  const entry = fields?.get(field)?.[0];
  return entry?.wireType === 2 ? parseMessage(entry.raw) : null;
}

const utf8 = new TextDecoder("utf-8", { fatal: true });
function printable(buf) {
  try {
    const text = utf8.decode(buf);
    return text.length > 0 && /^[\P{C}\n\t]*$/u.test(text) ? text : null;
  } catch {
    return null;
  }
}

// Schema-less JSON view of a payload, for capture logs: { "<field>": [values] }.
function toJson(buf, depth = 0) {
  const fields = parseMessage(buf);
  if (!fields) return { bytes: buf.toString("base64") };
  const out = {};
  for (const [field, entries] of fields) {
    out[field] = entries.map((entry) => {
      if (entry.wireType === 0) {
        const signed = BigInt.asIntN(64, entry.value);
        return signed >= -(2n ** 31n) && signed < 2n ** 31n ? Number(signed) : entry.value.toString();
      }
      if (entry.wireType === 1) return { fixed64: entry.raw.toString("hex") };
      if (entry.wireType === 5) return { fixed32: entry.raw.readUInt32LE(0) };
      const text = printable(entry.raw);
      const nested = depth < 8 && entry.raw.length > 0 ? parseMessage(entry.raw) : null;
      if (text !== null && (!nested || /[ \p{L}]{3,}/u.test(text))) return text;
      return nested ? toJson(entry.raw, depth + 1) : { bytes: entry.raw.toString("base64") };
    });
  }
  return out;
}

// Offset of the first plausible frame start, -1 if none, or "wait" if a candidate needs more bytes.
function findFrameStart(buf) {
  let from = 0;
  for (;;) {
    const marker = buf.indexOf(MARKER, from);
    if (marker === -1) return -1;
    for (let start = Math.max(0, marker - 24); start < marker; start++) {
      const length = readVarint(buf, start);
      if (!length || length.value === 0n || length.value > BigInt(MAX_UNSYNCED_FRAME)) continue;
      const end = length.next + Number(length.value);
      if (end <= marker) continue;
      if (end > buf.length) return "wait";
      if (decodeFrame(buf.subarray(length.next, end))) return start;
    }
    from = marker + 1;
  }
}

// Reassembles one TCP direction from (sequence, payload) segments and splits it into frames.
class FrameStream {
  constructor() {
    this.next = null;
    this.pending = new Map();
    this.buf = Buffer.alloc(0);
    this.synced = false;
  }

  push(seq, data) {
    if (this.next === null) this.next = seq >>> 0;
    const behind = (this.next - seq) >>> 0;
    if (behind > 0 && behind < 0x80000000) {
      if (behind >= data.length) return [];
      data = data.subarray(behind);
      seq = this.next;
    }
    this.pending.set(seq >>> 0, data);
    while (this.pending.has(this.next)) {
      const chunk = this.pending.get(this.next);
      this.pending.delete(this.next);
      this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
      this.next = (this.next + chunk.length) >>> 0;
    }
    if (this.pending.size > 256) this.reset();
    return this.drain();
  }

  reset() {
    this.pending.clear();
    this.next = null;
    this.buf = Buffer.alloc(0);
    this.synced = false;
  }

  drain() {
    const frames = [];
    for (;;) {
      if (!this.synced) {
        const start = findFrameStart(this.buf);
        if (start === "wait") break;
        if (start === -1) {
          this.buf = this.buf.subarray(Math.max(0, this.buf.length - MARKER.length - 24));
          break;
        }
        this.buf = this.buf.subarray(start);
        this.synced = true;
      }
      const length = readVarint(this.buf, 0);
      if (!length) break;
      if (length.value > BigInt(MAX_FRAME)) {
        this.desync();
        continue;
      }
      const end = length.next + Number(length.value);
      if (this.buf.length < end) break;
      const frame = this.buf.subarray(length.next, end);
      const decoded = decodeFrame(frame);
      if (!decoded) {
        this.desync();
        continue;
      }
      frames.push({ frame, decoded });
      this.buf = this.buf.subarray(end);
    }
    return frames;
  }

  desync() {
    this.synced = false;
    this.buf = this.buf.subarray(1);
  }
}

module.exports = { TYPE_PREFIX, readVarint, parseMessage, decodeFrame, varintField, messageField, toJson, FrameStream };
