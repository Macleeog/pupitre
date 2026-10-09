export type WalkthroughStepType =
  | "talk"
  | "map"
  | "walk"
  | "click"
  | "fight"
  | "item"
  | "dungeon"
  | "note"
  | "objective"

export type WalkthroughStep = {
  type: WalkthroughStepType
  text: string
  npc?: string
  choices?: string[]
  x?: number
  y?: number
  fightKind?: "solo" | "group" | "other"
}

export type Walkthrough = {
  name: string
  sources: ("duffus" | "tougli")[]
  duffusSlug?: string
  tougliGuides?: string[]
  objective?: string
  startNpc?: string
  startX?: number
  startY?: number
  zone?: string
  steps: WalkthroughStep[]
}

const SKIP_QSTEP = /^(qstep-map|qstep-map-inner|qstep-map-title|qstep-map-text|mob-stats-card)$/
const AD_OR_COMMENT =
  /adsbygoogle|pagead|soutiens?[-\s]?duffus|aucun commentaire|soyez le premier|rejoins le discord|duffusapp|ca-pub-|pub-449304/i
const COORD = /\[(-?\d+)\s*,\s*(-?\d+)\]/
const NPC_LINE = /parlez\s+à\s+([^:]+)\s*:/i

export function normalizeQuestName(value: string): string {
  return value
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[’ʻ`´]/g, "'")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
}

export function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|ol|ul)>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function sliceBalancedDiv(html: string, start: number): { inner: string; end: number } {
  let depth = 1
  let index = start
  const lower = html.toLowerCase()
  while (index < html.length && depth > 0) {
    const nextOpen = lower.indexOf("<div", index)
    const nextClose = lower.indexOf("</div>", index)
    if (nextClose < 0) return { inner: html.slice(start), end: html.length }
    const openIsTag = nextOpen >= 0 && nextOpen < nextClose && /<div[\s>/]/i.test(html.slice(nextOpen, nextOpen + 5))
    if (openIsTag) {
      depth += 1
      index = nextOpen + 4
    } else {
      depth -= 1
      if (depth === 0) return { inner: html.slice(start, nextClose), end: nextClose + 6 }
      index = nextClose + 6
    }
  }
  return { inner: html.slice(start), end: html.length }
}

function extractDivs(html: string, classNeedle: string): { className: string; attrs: string; inner: string }[] {
  const out: { className: string; attrs: string; inner: string }[] = []
  const re = /<div\b([^>]*\bclass="([^"]*)"[^>]*)>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const className = match[2]
    const tokens = className.split(/\s+/).filter(Boolean)
    if (!tokens.some((token) => token === classNeedle || token.startsWith(`${classNeedle}-`) || token.startsWith(`${classNeedle} `))) {
      if (!tokens.includes(classNeedle) && !tokens.some((token) => token.startsWith(classNeedle))) continue
    }
    if (!tokens.includes(classNeedle) && !tokens.some((token) => token === classNeedle)) {
      if (!tokens.some((token) => token === classNeedle || token.startsWith(`${classNeedle}`))) continue
    }
    if (!tokens.some((token) => token === classNeedle || token.startsWith(`${classNeedle}`))) continue
    const { inner, end } = sliceBalancedDiv(html, match.index + match[0].length)
    out.push({ className, attrs: match[1], inner })
    re.lastIndex = end
  }
  return out
}

function extractQsteps(html: string) {
  const out: { className: string; attrs: string; inner: string }[] = []
  const re = /<div\b([^>]*\bclass="([^"]*)"[^>]*)>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const tokens = match[2].split(/\s+/).filter(Boolean)
    if (!tokens.some((token) => token === "qstep" || token.startsWith("qstep"))) continue
    const { inner, end } = sliceBalancedDiv(html, match.index + match[0].length)
    out.push({ className: match[2], attrs: match[1], inner })
    re.lastIndex = end
  }
  return out
}

function attr(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))
  return match ? decodeEntities(match[1]) : null
}

function parseCoordText(text: string): { x: number; y: number } | null {
  const match = text.match(COORD)
  if (!match) return null
  return { x: Number(match[1]), y: Number(match[2]) }
}

function listItems(html: string): string[] {
  return [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
}

function classify(className: string): WalkthroughStepType | null {
  const tokens = className.split(/\s+/).filter(Boolean)
  if (tokens.some((token) => SKIP_QSTEP.test(token))) return null
  if (tokens.includes("dialogue")) return "talk"
  if (tokens.includes("move")) return "map"
  if (tokens.includes("marche")) return "walk"
  if (tokens.includes("clique")) return "click"
  if (tokens.includes("combat")) return "fight"
  if (tokens.includes("item") || tokens.includes("craft") || tokens.includes("ressource")) return "item"
  if (tokens.includes("donjon") || tokens.includes("dungeon")) return "dungeon"
  if (tokens.includes("astuce") || tokens.includes("info") || tokens.includes("text")) return "note"
  if (tokens.includes("qstep")) return "note"
  return null
}

function fightKind(attrs: string, text: string): WalkthroughStep["fightKind"] {
  const kind = (attr(attrs, "data-kind") || "").toLowerCase()
  if (kind === "solo" || kind === "group") return kind
  if (/groupe|group/i.test(text)) return "group"
  if (/solo/i.test(text)) return "solo"
  return "other"
}

function npcFrom(inner: string, attrs: string, text: string): string | undefined {
  const data = attr(attrs, "data-npc")
  if (data) return data.trim()
  const match = text.match(NPC_LINE)
  if (match) return match[1].replace(/\s+/g, " ").trim()
  const bold = inner.match(/Parlez à[^<]*<span[^>]*>([^<]+)<\/span>/i)
  if (bold) return stripTags(bold[1]).replace(/:$/, "").trim()
  return undefined
}

export function parseWalkthroughHtml(html: string): { objective?: string; steps: WalkthroughStep[] } {
  if (!html) return { steps: [] }
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")

  let objective: string | undefined
  for (const card of extractDivs(cleaned, "qk-card")) {
    if (!/\binfo\b/.test(card.className)) continue
    const title = stripTags(card.inner.match(/<div class="qk-title">([\s\S]*?)<\/div>/i)?.[1] ?? "")
    const body = stripTags(card.inner.replace(/<div class="qk-title">[\s\S]*?<\/div>/i, ""))
    if (title.toLowerCase() === "objectif" && body) objective = body
  }

  const steps: WalkthroughStep[] = []
  for (const block of extractQsteps(cleaned)) {
    const type = classify(block.className)
    if (!type) continue
    if (AD_OR_COMMENT.test(block.inner)) continue
    const choices = listItems(block.inner)
    const text = stripTags(
      block.inner
        .replace(/<ol\b[\s\S]*?<\/ol>/gi, " ")
        .replace(/<ul\b[\s\S]*?<\/ul>/gi, " "),
    )
    if (AD_OR_COMMENT.test(text)) continue
    const coords = parseCoordText(block.inner) ?? parseCoordText(text)
    const npc = type === "talk" ? npcFrom(block.inner, block.attrs, text) : undefined
    const cleanedText = text
      .replace(NPC_LINE, "")
      .replace(COORD, "")
      .replace(/^[:.\-–—\s]+/, "")
      .trim()
    const step: WalkthroughStep = { type, text: cleanedText || (npc ? `Parlez à ${npc}` : "") }
    if (npc) step.npc = npc
    if (choices.length) step.choices = choices
    if (coords) {
      step.x = coords.x
      step.y = coords.y
    }
    if (type === "fight") step.fightKind = fightKind(block.attrs, `${text} ${choices.join(" ")}`)
    if (!step.text && !step.npc && !step.choices && step.x == null) continue
    if (!step.text && step.npc) step.text = `Parlez à ${step.npc}`
    if (!step.text && step.x != null) step.text = "Se rendre sur la carte."
    steps.push(step)
  }

  return { objective, steps }
}

export function parseCoordPair(raw: string | null | undefined): { x: number; y: number } | null {
  if (!raw) return null
  return parseCoordText(raw)
}

export function mergeTougliHints(
  walkthrough: Walkthrough,
  tougli: {
    fights?: { kind?: string; text: string }[]
    items?: string[]
  },
): Walkthrough {
  const steps = [...walkthrough.steps]
  const existing = new Set(steps.map((step) => normalizeQuestName(step.text)))
  for (const fight of tougli.fights ?? []) {
    const text = fight.text.trim()
    if (!text || existing.has(normalizeQuestName(text))) continue
    steps.push({
      type: "fight",
      text,
      fightKind: fight.kind === "solo" || fight.kind === "group" ? fight.kind : "other",
    })
  }
  if (tougli.items?.length) {
    const text = `Prévoir : ${tougli.items.join(", ")}`
    if (!existing.has(normalizeQuestName(text))) {
      steps.push({ type: "item", text })
    }
  }
  const sources = walkthrough.sources.includes("tougli") ? walkthrough.sources : [...walkthrough.sources, "tougli" as const]
  return { ...walkthrough, sources, steps }
}

export function walkthroughFromNote(name: string, note: string, extra?: Partial<Walkthrough>): Walkthrough | null {
  const text = stripTags(note)
  if (text.length < 12) return null
  if (AD_OR_COMMENT.test(text)) return null
  return {
    name,
    sources: extra?.sources ?? ["duffus"],
    steps: [{ type: "note", text }],
    ...extra,
  }
}
