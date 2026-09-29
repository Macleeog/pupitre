import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { FrameStream, interpret, readVarint } = createRequire(import.meta.url)("../desktop/pupitre-sniffer.cjs");
const hex = (s) => Buffer.from(s.replace(/\s+/g, ""), "hex");

const KOB = hex("1d 12 1b 1a 19 0a 13 74 79 70 65 2e 61 6e 6b 61 6d 61 2e 63 6f 6d 2f 6b 6f 62 12 02 08 01");
const KNZ = hex("28 0a 26 0a 19 0a 13 74 79 70 65 2e 61 6e 6b 61 6d 61 2e 63 6f 6d 2f 6b 6e 7a 12 02 10 01 10 ff ff ff ff ff ff ff ff ff 01");

test("varint sur deux octets", () => {
  assert.equal(readVarint(hex("d8 01"), 0).value, 216n);
});

test("evenement serveur decoupe et classe", () => {
  const frames = new FrameStream().push(100, KOB);
  assert.equal(frames.length, 1);
  const m = interpret(frames[0]);
  assert.equal(m.kind, "event");
  assert.equal(m.wireType, "kob");
  assert.equal(m.unknown, false);
});

test("requete client avec uid -1", () => {
  const [f] = new FrameStream().push(1, KNZ);
  const m = interpret(f);
  assert.equal(m.kind, "request");
  assert.equal(m.uid, -1);
  assert.equal(m.wireType, "knz");
});

test("segments hors ordre apres le premier, trame coupee, doublons", () => {
  const all = Buffer.concat([KNZ, KOB]);
  const a = all.subarray(0, 10), b = all.subarray(10, 45), c = all.subarray(45);
  const fs = new FrameStream();
  const out = [...fs.push(1000, a), ...fs.push(1000, a), ...fs.push(1000 + 45, c), ...fs.push(1000 + 10, b)];
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((f) => interpret(f).wireType), ["knz", "kob"]);
});

test("donnees illisibles : jamais d'exception", () => {
  assert.equal(interpret(hex("ff ff ff")).unknown, true);
});
