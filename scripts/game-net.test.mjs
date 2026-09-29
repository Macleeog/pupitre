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

test("combat réel : le combattant -1 du jeu n'est pas compté", () => {
  const events = [];
  const fights = createFightTracker((e) => events.push(e));
  fights.handle("2", { type: "jvt", value: order(27038515495n, 18446744073709551615n) }, 1000);
  fights.handle("2", { type: "jwd", value: intField(7, 18446744073709551615n) }, 1100);
  fights.handle("2", { type: "jwd", value: intField(7, 27038515495n) }, 1200);
  assert.equal(events[0].fighters, 1);
  assert.deepEqual(
    events.slice(1).map((e) => e.fighterId),
    ["27038515495"],
  );
});

const NONE = 18446744073709551615n;
const ME = 27038515495n;

function fightEnd(fighters) {
  const stack = (itemId, quantity) => Buffer.concat([intField(1, itemId), intField(4, quantity)]);
  const entry = ({ id, xp = 0, kamas = 0, items = [] }) => {
    const gain = bytesField(4, Buffer.concat([intField(2, 378), bytesField(3, bytesField(1, Buffer.concat([intField(1, xp), intField(2, 1)])))]));
    const fighter = bytesField(1, Buffer.concat([...(xp ? [gain] : []), intField(5, 1), intField(6, id)]));
    const stacks = items.map(([itemId, quantity]) => bytesField(3, stack(itemId, quantity)));
    const loot = items.length || kamas
      ? bytesField(2, Buffer.concat([bytesField(2, Buffer.concat([intField(2, 489), ...stacks])), intField(3, kamas)]))
      : bytesField(2, Buffer.alloc(0));
    return bytesField(5, Buffer.concat([fighter, loot, intField(4, 2)]));
  };
  return Buffer.concat([intField(4, 4222), ...fighters.map(entry), intField(6, NONE)]);
}

test("fin de combat réelle : durée, XP, kamas et butin du joueur", () => {
  const payload = fightEnd([
    { id: ME, xp: 125, kamas: 3, items: [[17123, 1], [6900, 2], [287, 1]] },
    { id: NONE },
  ]);
  const events = [];
  const fights = createFightTracker((e) => events.push(e));
  fights.handle("0", { type: "jwe", value: payload }, 5000);
  assert.deepEqual(events, [
    {
      type: "fight-end",
      at: 5000,
      durationMs: 4222,
      results: [
        {
          fighterId: "27038515495",
          xp: 125,
          kamas: 3,
          items: [
            { itemId: 17123, quantity: 1 },
            { itemId: 6900, quantity: 2 },
            { itemId: 287, quantity: 1 },
          ],
          mine: true,
        },
      ],
      ownFighterIds: [],
    },
  ]);
});

test("groupe de deux joueurs : seul le personnage qui joue depuis ce PC est à lui", () => {
  const other = 30000000001n;
  const events = [];
  const fights = createFightTracker((e) => events.push(e));
  const msg = (type, value = Buffer.alloc(0)) => ({ type, value });
  fights.handle("0", msg("jvt", order(ME, other, NONE)), 1000);
  fights.handle("0", msg("jwd", intField(7, other)), 1100);
  fights.handle("0", msg("jwc", intField(1, other)), 1200);
  fights.handle("0", msg("jwd", intField(7, ME)), 1300);
  fights.handle("0", msg("jrj", intField(1, 12757)), 1400, "out");
  fights.handle("0", msg("jvv"), 1500, "out");
  fights.handle("0", msg("jwc", intField(1, ME)), 1600);
  fights.handle("0", msg("jwd", intField(7, NONE)), 1700);
  fights.handle("0", msg("jvv"), 1750, "out");
  assert.deepEqual(fights.ownFighterIds(), ["27038515495"]);
  fights.handle(
    "0",
    msg("jwe", fightEnd([
      { id: ME, xp: 125, kamas: 3, items: [[17123, 1]] },
      { id: other, xp: 90, kamas: 5, items: [[6900, 1]] },
      { id: NONE },
    ])),
    9000,
  );
  const end = events.at(-1);
  assert.equal(end.type, "fight-end");
  assert.deepEqual(end.ownFighterIds, ["27038515495"]);
  assert.deepEqual(
    end.results.map((r) => [r.fighterId, r.mine]),
    [
      ["27038515495", true],
      ["30000000001", false],
    ],
  );
});

test("sans personnage reconnu : un seul gagnant est crédité, plusieurs ne le sont pas", () => {
  const events = [];
  const fights = createFightTracker((e) => events.push(e));
  fights.handle("0", { type: "jwe", value: fightEnd([{ id: ME, xp: 125, kamas: 3 }, { id: NONE }]) }, 1000);
  fights.handle(
    "0",
    { type: "jwe", value: fightEnd([{ id: ME, xp: 125, kamas: 3 }, { id: 30000000001n, xp: 90 }]) },
    9000,
  );
  assert.deepEqual(events[0].results.map((r) => r.mine), [true]);
  assert.deepEqual(events[1].results.map((r) => r.mine), [false, false]);
});

test("lecteur : les requêtes sortantes pendant son tour désignent son personnage", () => {
  const reader = new GameNetReader({ capturesDir: os.tmpdir() });
  const jrj = framed(bytesField(1, Buffer.concat([bytesField(1, any("jrj", intField(1, 12757))), intField(2, 7)])));
  reader.handleLine(["1700000000.5", "5555", "4", "100", "", framed(event("jwd", intField(7, ME))).toString("hex")].join("\t"));
  reader.handleLine(["1700000001.0", "51000", "4", "900", "", jrj.toString("hex")].join("\t"));
  assert.deepEqual(reader.snapshot().ownFighterIds, ["27038515495"]);
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
