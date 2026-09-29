// Every message type seen in the captures of 2026-09-29. Ankama renames all obfuscated types
// together on a game update, so a session where most types are unknown means the fight codes in
// fights.cjs and market.cjs are probably stale too. Refresh both from a new capture.
const KNOWN_TYPES = new Set([
  "hlp", "hpo", "hpr", "hps", "iii", "iir", "imp", "ine", "isa", "isb", "isf", "isx", "iup",
  "iva", "ivf", "iyo", "ize", "jfp", "jon", "joo", "jop", "joq", "jou", "jpo", "jpp", "jpt",
  "jpw", "jpx", "jqb", "jqy", "jqz", "jrj", "jro", "jrs", "jue", "juh", "jul", "jun", "juo",
  "jus", "juu", "juz", "jva", "jvj", "jvk", "jvn", "jvt", "jvv", "jwc", "jwd", "jwe", "jxh",
  "jxl", "jxu", "jxw", "jyf", "jyk", "jyl", "jym", "jyn", "jyo", "jyq", "jzi", "kby", "ket",
  "kiy", "kkc", "kkf", "kkg", "kki", "kkr", "knz", "kob", "kqf", "krf", "krk", "krn", "kru",
  "kty", "kua", "kub", "kuh", "kui", "kul", "kum", "kun", "kuo", "kuq", "lob", "loc", "log",
  "loh", "lok", "loq", "lsz", "lxd",
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
