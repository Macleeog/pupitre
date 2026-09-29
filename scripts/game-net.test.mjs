import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { FrameStream, decodeFrame, readVarint } = require("../desktop/game-net/decode.cjs");
const { createFightTracker } = require("../desktop/game-net/fights.cjs");
const { GameNetReader, captureFilter } = require("../desktop/game-net/reader.cjs");

const hex = (s) => Buffer.from(s.replace(/\s+/g, ""), "hex");

function varint(value) {
  let n = BigInt(value);
  const bytes = [];
  do {
    let byte = Number(n & 0x7fn);
    n >>= 7n;
    if (n > 0n) byte |= 0x80;
    bytes.push(byte);
  } while (n > 0n);
  return Buffer.from(bytes);
}
const bytesField = (field, payload) => Buffer.concat([varint((field << 3) | 2), varint(payload.length), payload]);
const intField = (field, value) => Buffer.concat([varint(field << 3), varint(value)]);
const any = (type, value = Buffer.alloc(0)) =>
  Buffer.concat([bytesField(1, Buffer.from(`type.ankama.com/${type}`)), bytesField(2, value)]);
const event = (type, value) => bytesField(2, bytesField(3, any(type, value)));
const framed = (envelope) => Buffer.concat([varint(envelope.length), envelope]);

const KOB = hex("1d 12 1b 1a 19 0a 13 74 79 70 65 2e 61 6e 6b 61 6d 61 2e 63 6f 6d 2f 6b 6f 62 12 02 08 01");
const KNZ = hex(
  "28 0a 26 0a 19 0a 13 74 79 70 65 2e 61 6e 6b 61 6d 61 2e 63 6f 6d 2f 6b 6e 7a 12 02 10 01 10 ff ff ff ff ff ff ff ff ff 01",
);

test("varint sur deux octets", () => {
  assert.equal(readVarint(hex("d8 01"), 0).value, 216n);
});

test("événement serveur découpé et classé", () => {
  const frames = new FrameStream().push(100, KOB);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].decoded.kind, "event");
  assert.deepEqual(
    frames[0].decoded.messages.map((m) => m.type),
    ["kob"],
  );
});

test("requête client", () => {
  const [{ decoded }] = new FrameStream().push(1, KNZ);
  assert.equal(decoded.kind, "request");
  assert.equal(decoded.messages[0].typeUrl, "type.ankama.com/knz");
});

test("segments hors ordre, trame coupée, doublons", () => {
  const all = Buffer.concat([KNZ, KOB]);
  const a = all.subarray(0, 10);
  const b = all.subarray(10, 45);
  const c = all.subarray(45);
  const stream = new FrameStream();
  const out = [...stream.push(1000, a), ...stream.push(1000, a), ...stream.push(1045, c), ...stream.push(1010, b)];
  assert.deepEqual(
    out.map((f) => f.decoded.messages[0].type),
    ["knz", "kob"],
  );
});

test("plusieurs messages dans une même trame", () => {
  const envelope = bytesField(2, Buffer.concat([bytesField(3, any("aaa")), bytesField(3, any("bbb"))]));
  assert.deepEqual(
    decodeFrame(envelope).messages.map((m) => m.type),
    ["aaa", "bbb"],
  );
});

test("se recale quand la lecture démarre au milieu d'une connexion", () => {
  const data = Buffer.concat([framed(event("old", Buffer.alloc(40, 7))), KOB, framed(event("zzz"))]);
  const stream = new FrameStream();
  const frames = stream.push(5000, data.subarray(17));
  assert.deepEqual(
    frames.map((f) => f.decoded.messages[0].type),
    ["kob", "zzz"],
  );
});

test("données illisibles : jamais d'exception", () => {
  assert.equal(decodeFrame(hex("ff ff ff")), null);
  assert.deepEqual(new FrameStream().push(1, hex("ff ff ff 00 01 02")), []);
});

const order = (...ids) => Buffer.concat(ids.map((id) => bytesField(1, bytesField(2, intField(1, id)))));

test("combat : début, tours, fin comptée une fois en multicompte", () => {
  const events = [];
  const fights = createFightTracker((e) => events.push(e));
  const msg = (type, value = Buffer.alloc(0)) => ({ type, value });
  fights.handle("1", msg("jvt", order(11, 12, 99)), 1000);
  fights.handle("2", msg("jvt", order(11, 12, 99)), 1010);
  assert.equal(fights.inFight(), true);
  fights.handle("1", msg("jwd", intField(7, 11)), 1100);
  fights.handle("2", msg("jwd", intField(7, 11)), 1105);
  fights.handle("1", msg("jwc", intField(1, 11)), 1200);
  fights.handle("1", msg("jwe"), 2000);
  fights.handle("2", msg("jwe"), 2020);
  assert.equal(fights.inFight(), false);
  assert.deepEqual(
    events.map((e) => e.type),
    ["fight-start", "turn-start", "turn-end", "fight-end"],
  );
  assert.equal(events[0].fighters, 3);
  assert.equal(events[1].fighterId, "11");
  fights.handle("1", msg("jwe"), 9000);
  assert.equal(events.at(-1).type, "fight-end");
  assert.equal(events.filter((e) => e.type === "fight-end").length, 2);
});

test("filtre de capture limité aux serveurs de jeu", () => {
  assert.equal(captureFilter([]), "tcp port 5555");
  assert.equal(
    captureFilter(["1.2.3.4", "5.6.7.8"]),
    "tcp and (port 5555 or (port 443 and (host 1.2.3.4 or host 5.6.7.8)))",
  );
});

test("lecteur : ligne tshark → messages, combat détecté, fichier de capture", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pupitre-net-"));
  const events = [];
  const reader = new GameNetReader({ capturesDir: dir, onEvent: (e) => events.push(e) });
  const file = reader.startCapture();
  const inbound = Buffer.concat([framed(event("jvt", order(1, 2))), framed(event("jwe"))]);
  reader.handleLine(["1700000000.5", "5555", "3", "777", "", inbound.toString("hex")].join("\t"));
  reader.handleLine(["1700000001.0", "51000", "3", "90", "", KNZ.toString("hex")].join("\t"));
  const state = reader.snapshot();
  assert.equal(state.messages, 3);
  assert.equal(state.capture.count, 3);
  assert.deepEqual(
    events.map((e) => e.type),
    ["fight-start", "fight-end"],
  );
  assert.deepEqual(
    state.types.map((t) => [t.type, t.in, t.out]).sort(),
    [
      ["jvt", 1, 0],
      ["jwe", 1, 0],
      ["knz", 0, 1],
    ],
  );
  const stopped = reader.stopCapture();
  assert.equal(stopped.file, file);
  return new Promise((resolve) => setTimeout(resolve, 50)).then(() => {
    const lines = fs.readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(lines.length, 3);
    assert.equal(lines[0].type, "jvt");
    assert.equal(lines[0].direction, "in");
    assert.equal(lines[2].direction, "out");
    assert.ok(lines[0].fields["1"]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
