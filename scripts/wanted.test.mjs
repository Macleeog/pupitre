import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { createWantedWatch, monsterKind } = require("../desktop/game-net/wanted.cjs")
const { lookupMapCoords } = require("../desktop/game-net/map-coords.cjs")

function varint(value) {
  let n = BigInt(value)
  const bytes = []
  do {
    let byte = Number(n & 0x7fn)
    n >>= 7n
    if (n > 0n) byte |= 0x80
    bytes.push(byte)
  } while (n > 0n)
  return Buffer.from(bytes)
}

const bytesField = (field, payload) => Buffer.concat([varint((field << 3) | 2), varint(payload.length), payload])
const intField = (field, value) => Buffer.concat([varint(field << 3), varint(value)])

function signedVarint(value) {
  let n = BigInt.asUintN(64, BigInt(value))
  const bytes = []
  do {
    let byte = Number(n & 0x7fn)
    n >>= 7n
    if (n > 0n) byte |= 0x80
    bytes.push(byte)
  } while (n > 0n)
  return Buffer.from(bytes)
}

const intFieldSigned = (field, value) => Buffer.concat([varint(field << 3), signedVarint(value)])

function creature(monsterId, level) {
  return Buffer.concat([intField(1, 1), intField(2, monsterId), intField(3, level)])
}

function groupActor(groupId, monsterId, level) {
  return Buffer.concat([bytesField(1, bytesField(1, creature(monsterId, level))), intFieldSigned(2, groupId)])
}

function mapPopulation(mapId, actors) {
  return Buffer.concat([intField(6, mapId), ...actors.map((actor) => bytesField(9, actor))])
}

function groupLink(monsterId, x, y, composition, groupId, world = 1) {
  const point = Buffer.concat([intFieldSigned(1, x), intFieldSigned(2, y)])
  return Buffer.concat([
    intField(1, monsterId),
    bytesField(2, point),
    intField(4, world),
    bytesField(5, Buffer.from(composition)),
    intFieldSigned(8, groupId),
  ])
}

function chatLink(monsterId, x, y, composition, groupId, world = 1) {
  return bytesField(10, bytesField(2, groupLink(monsterId, x, y, composition, groupId, world)))
}

// Capture of 2026-10-09T02:46:41Z, kpy: point { 1: y, 3: x }, world in field 3,
// group id in field 4, composition in field 6, archimonster id in field 8.
function octoberGroupLink(composition, groupId, monsterId, y, x, world = 1) {
  const point = Buffer.concat([intFieldSigned(1, y), intFieldSigned(3, x)])
  return Buffer.concat([
    bytesField(2, point),
    intField(3, world),
    intFieldSigned(4, groupId),
    bytesField(6, Buffer.from(composition)),
    intField(8, monsterId),
  ])
}

test("avis de recherche : Ka'Youloud est signalé à l'arrivée sur la carte, une seule fois", () => {
  const events = []
  const watch = createWantedWatch((event) => events.push(event))
  const kayouloud = mapPopulation(174851076, [groupActor(-20004, 4737, 170), groupActor(-20000, 3597, 40)])
  watch.handle({ type: "jpo", value: kayouloud }, 1000)
  assert.equal(events.length, 1)
  assert.equal(events[0].type, "wanted-sighting")
  assert.equal(events[0].text, "Ka'Youloud est sur cette carte.")
  assert.equal(events[0].monsters[0].id, 4737)
  assert.equal(events[0].monsters[0].gfxId, 1541)
  assert.equal(events[0].mapId, 174851076)
  watch.handle({ type: "jpo", value: kayouloud }, 2000)
  assert.equal(events.length, 1)
  const empty = mapPopulation(174852100, [groupActor(-20006, 3597, 40)])
  watch.handle({ type: "jpo", value: empty }, 3000)
  assert.equal(events.at(-1).type, "wanted-absent")
})

test("avis de recherche : Sicogne reconnu par la description du groupe déjà sur la carte", () => {
  const events = []
  const watch = createWantedWatch((event) => events.push(event))
  const composition = Buffer.concat([
    bytesField(5, Buffer.from("4x3851x200|1x3838x200|3x3836x206")),
    intFieldSigned(8, -20002),
  ])
  watch.handle({ type: "jpt", value: intField(3, 144575492) }, 1000)
  watch.handle({ type: "kqd", value: composition }, 1100)
  assert.equal(events.length, 0)
  watch.handle({ type: "joq", value: intFieldSigned(3, -20002) }, 1200)
  assert.equal(events.length, 1)
  assert.equal(events[0].text, "Sicogne est sur cette carte.")
  watch.handle({ type: "joq", value: intFieldSigned(3, -20002) }, 1300)
  assert.equal(events.length, 1)
})

test("avis de recherche : un groupe décrit hors de la carte ne prévient pas", () => {
  const events = []
  const watch = createWantedWatch((event) => events.push(event))
  const elsewhere = Buffer.concat([bytesField(5, Buffer.from("1x2508x200")), intFieldSigned(8, -20000)])
  watch.handle({ type: "kqf", value: elsewhere }, 1000)
  watch.handle({ type: "joq", value: intFieldSigned(3, -20009) }, 1100)
  assert.equal(events.length, 0)
})

test("chat : archimonstre et avis de recherche gardent la carte du message", () => {
  const events = []
  const watch = createWantedWatch((event) => events.push(event))
  watch.handle({ type: "jpo", value: mapPopulation(205522438, [groupActor(-20001, 3597, 40)]) }, 1000)
  watch.handle({ type: "kqf", value: chatLink(2473, -2, -56, "5x2473x158|3x3558x156", -20001) }, 1100)
  watch.handle({ type: "kqf", value: chatLink(3851, 14, -33, "1x3851x200", -20002) }, 1200)
  const sights = events.filter((event) => event.type === "wanted-sighting")
  assert.deepEqual(
    sights.map((event) => [event.monsters[0].name, event.monsters[0].kind, event.coords, event.mapId]),
    [
      ["Félyssion la Gourmande", "archi", { x: -2, y: -56 }, null],
      ["Sicogne", "wanted", { x: 14, y: -33 }, null],
    ],
  )
  watch.handle({ type: "kqf", value: chatLink(2473, -2, -56, "5x2473x158|3x3558x156", -20001) }, 1300)
  assert.equal(events.filter((event) => event.type === "wanted-sighting").length, 2)
})

test("chat : le lien garde -50,-44, et un autre monde n'est pas la carte du joueur", () => {
  const events = []
  const watch = createWantedWatch((event) => events.push(event))
  watch.handle({ type: "jpo", value: mapPopulation(174851076, [groupActor(-20000, 4737, 170)]) }, 1000)
  const link = groupLink(3400, -50, -44, "4x3400x190|5x2932x190", -20000, 1)
  watch.handle({ type: "kqd", value: bytesField(4, bytesField(2, link)) }, 1100)
  watch.handle({ type: "kqf", value: bytesField(10, bytesField(2, link)) }, 1200)
  const eggob = events.filter((event) => event.coords)
  assert.equal(eggob.length, 1)
  assert.equal(eggob[0].monsters[0].name, "Docteur Eggob")
  assert.equal(eggob[0].monsters[0].kind, "wanted")
  assert.deepEqual(eggob[0].coords, { x: -50, y: -44 })
  assert.equal(eggob[0].mapId, null)
  assert.equal(eggob[0].text, "Docteur Eggob est en -50,-44.")
  watch.handle({ type: "kqf", value: chatLink(3760, 7, 9, "2x3760x1440", -20002, 14) }, 1300)
  assert.deepEqual(events.at(-1).coords, { x: 7, y: 9, world: 14 })
  assert.equal(events.at(-1).text, "Mouchâme est en 7,9, sur un autre monde.")
  watch.handle({ type: "kqf", value: chatLink(2450, -7, 28, "3x2450x66", -20003, 1) }, 1400)
  assert.equal(events.at(-1).monsters[0].kind, "archi")
  watch.handle({ type: "kqf", value: chatLink(4507, 25, 34, "5x4507x200", -20001, 17) }, 1500)
  assert.deepEqual(events.at(-1).coords, { x: 25, y: 34, world: 17 })
  watch.handle({ type: "kqd", value: Buffer.from("Recrute {chatmonster,3400}") }, 1600)
  assert.equal(events.filter((event) => event.type === "wanted-sighting").length, 5)
})

test("archimonstre : Kiroyal est signalé, sans se mêler d'un monstre ordinaire", () => {
  const events = []
  const watch = createWantedWatch((event) => events.push(event))
  const carte = mapPopulation(174851076, [groupActor(-20004, 2508, 35), groupActor(-20005, 3597, 40)])
  watch.handle({ type: "jpo", value: carte }, 1000)
  assert.equal(events.length, 1)
  assert.equal(events[0].text, "Kiroyal le Sirupeux est sur cette carte.")
  assert.equal(events[0].monsters[0].kind, "archi")
  assert.equal(events[0].monsters[0].gfxId, 90)
  assert.equal(monsterKind(2508), "archi")
  assert.equal(monsterKind(4737), "wanted")
  assert.equal(monsterKind(3597), null)
})

test("coordonnées : DofusDB map-positions, puis le cache", async () => {
  const file = path.join(os.tmpdir(), `pupitre-maps-${Date.now()}.json`)
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return { ok: true, json: async () => ({ posX: 8, posY: -68 }) }
  }
  const first = await lookupMapCoords(174851076, { cacheFile: file, fetchImpl })
  const second = await lookupMapCoords(174851076, { cacheFile: file, fetchImpl })
  assert.deepEqual(first, { x: 8, y: -68 })
  assert.deepEqual(second, first)
  assert.equal(calls, 1)
  fs.rmSync(file, { force: true })
})

test("chat du 2026-10-09 : Alhoui est annoncé en -1,-55, et un bestiaire ne prévient pas", () => {
  const events = []
  const watch = createWantedWatch((event) => events.push(event))
  const composition = "1x2472x152|2x3560x152|3x3560x154|3x3562x155|5x3562x159|5x3558x160|3x3562x155"
  const link = bytesField(6, bytesField(2, octoberGroupLink(composition, -20002, 2472, -55, -1, 1)))
  watch.handle({ type: "kpy", value: link }, 1000)
  assert.equal(events.length, 1)
  assert.equal(events[0].type, "wanted-sighting")
  assert.equal(events[0].monsters[0].name, "Alhoui le Répondeur")
  assert.equal(events[0].monsters[0].kind, "archi")
  assert.equal(events[0].monsters[0].gfxId, 682)
  assert.deepEqual(events[0].coords, { x: -1, y: -55 })
  assert.equal(events[0].mapId, null)
  assert.equal(events[0].text, "Alhoui le Répondeur est en -1,-55.")
  watch.handle({ type: "kpy", value: link }, 1100)
  watch.handle({ type: "ibj", value: intField(1, 2524) }, 1200)
  watch.handle({ type: "icj", value: bytesField(1, intField(1, 2534)) }, 1300)
  assert.equal(events.filter((event) => event.type === "wanted-sighting").length, 1)
})
