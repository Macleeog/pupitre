import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { KNOWN_TYPES, codesHealth } = require("../desktop/game-net/known-types.cjs")

// Every distinct type in capture-2026-10-09T02-46-41-938Z (1103 messages).
const CAPTURE_2026_10_09 = [
  "hkg", "hkk", "hms", "ibj", "icj", "igk", "igp", "ilr", "jnj", "jns", "jnv", "jny", "jnz",
  "jok", "jow", "jpe", "jpk", "jpp", "jqh", "jqk", "jsq", "jsr", "jst", "jsy", "jtd", "jte",
  "jth", "jti", "jtk", "juf", "jug", "juh", "jun", "juo", "jup", "juu", "jvi", "jvj", "jvk",
  "jvu", "jwh", "jwj", "jwo", "jwp", "jww", "jxa", "jxb", "jxd", "jxh", "jxi", "jxj", "jxk",
  "jxm", "jxr", "kjl", "kjp", "kjt", "kjy", "kjz", "knb", "kne", "kpy", "kqo", "kqw", "krg",
  "krm", "kth", "ktk", "ktl", "ktm", "ktn", "kto", "ktr", "ktt", "ktx", "kua", "kue", "lof",
  "lok", "ltb", "ltc", "lxg",
]

test("the 2026-10-09 capture is a known type list", () => {
  assert.equal(CAPTURE_2026_10_09.length, 82)
  for (const type of CAPTURE_2026_10_09) assert.equal(KNOWN_TYPES.has(type), true, type)
  const health = codesHealth(CAPTURE_2026_10_09, 1103)
  assert.equal(health.state, "ok")
  assert.equal(health.knownShare, 1)
})
