// Message types from the captures of 2026-09-29, plus every type in the capture of
// 2026-10-09T02:46:41Z. Ankama renames obfuscated types together on a game update.
// A session where most types are unknown means the decoders are probably stale.
const KNOWN_TYPES = new Set([
  "hkg", "hkk", "hlp", "hms", "hpo", "hpr", "hps", "ibj", "icj", "igk", "igp", "iii", "iir",
  "ilr", "imp", "ine", "isa", "isb", "isf", "isx", "iup", "iva", "ivf", "iyo", "ize", "jfp",
  "jnj", "jns", "jnv", "jny", "jnz", "jok", "jon", "joo", "jop", "joq", "jou", "jow", "jpe",
  "jpk", "jpo", "jpp", "jpq", "jpt", "jpw", "jpx", "jqb", "jqh", "jqk", "jqy", "jqz", "jrj",
  "jro", "jrs", "jsq", "jsr", "jst", "jsy", "jtd", "jte", "jth", "jti", "jtk", "jue", "juf",
  "jug", "juh", "jul", "jun", "juo", "jup", "jus", "juu", "juz", "jva", "jvi", "jvj", "jvk",
  "jvn", "jvt", "jvu", "jvv", "jwc", "jwd", "jwe", "jwh", "jwj", "jwo", "jwp", "jww", "jxa",
  "jxb", "jxd", "jxh", "jxi", "jxj", "jxk", "jxl", "jxm", "jxr", "jxu", "jxw", "jyf", "jyk",
  "jyl", "jym", "jyn", "jyo", "jyq", "jzi", "jzn", "kby", "kde", "kdr", "ket", "kev", "kiy",
  "kjl", "kjp", "kjt", "kjy", "kjz", "kkc", "kkf", "kkg", "kki", "kkr", "knb", "kne", "knz",
  "kob", "kpy", "kqf", "kqo", "kqw", "krf", "krg", "krk", "krm", "krn", "kru", "kth", "ktk",
  "ktl", "ktm", "ktn", "kto", "ktr", "ktt", "ktx", "kty", "kua", "kub", "kue", "kuh", "kui",
  "kul", "kum", "kun", "kuo", "kuq", "lob", "loc", "lof", "log", "loh", "lok", "loq", "lsz",
  "ltb", "ltc", "lxd", "lxg"
]);

const MIN_MESSAGES = 300;
const MIN_TYPES = 15;
const MIN_KNOWN_SHARE = 0.4;

// "ok" | "unknown" (not enough traffic yet) | "stale"
function codesHealth(types, messages) {
  if (messages < MIN_MESSAGES || types.length < MIN_TYPES) return { state: "unknown", knownShare: null };
  const known = types.filter((type) => KNOWN_TYPES.has(type)).length;
  const knownShare = known / types.length;
  return { state: knownShare < MIN_KNOWN_SHARE ? "stale" : "ok", knownShare };
}

module.exports = { KNOWN_TYPES, codesHealth };
