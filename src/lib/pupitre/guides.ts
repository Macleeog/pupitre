import catalog from "@/data/guides.json"
import gainsCatalog from "@/data/guide-gains.json"

type DoneMap = Record<string, true | undefined>

export type GuideChapterKind = "prereq" | "main"

export type GuideChapter = {
  title: string
  questIds: number[]
  kind?: GuideChapterKind
  info?: string
  takeQuestIds?: number[]
}

export type GuideSection = "dofus" | "secondaires" | "alignement" | "evenements" | "fusion"

export type GuideObjectiveKind = "dungeon" | "combat" | "bashMobs" | "hours" | "group"

export type GuideObjectiveCounters = Record<GuideObjectiveKind, number>

export type GuideGains = {
  tougliSlug: string
  flavor: string | null
  level: number | null
  kamasQuest: number
  kamasAchievement: number
  achievementIds: number[]
  counters: GuideObjectiveCounters
  countersByQuest: Record<string, Partial<GuideObjectiveCounters>>
}

export type GuideDefinition = {
  slug: string
  title: string
  levelMin: number
  levelMax: number
  section: GuideSection
  itemId: number | null
  iconId: number | null
  questIds: number[]
  chapters?: GuideChapter[]
  notice?: string
  gains?: GuideGains
}

export const OBJECTIVE_COUNTERS: { id: GuideObjectiveKind; label: string }[] = [
  { id: "dungeon", label: "Donjons" },
  { id: "combat", label: "Combats" },
  { id: "bashMobs", label: "Monstres" },
  { id: "hours", label: "Horaires" },
  { id: "group", label: "Groupe" },
]

const EMPTY_COUNTERS: GuideObjectiveCounters = {
  dungeon: 0,
  combat: 0,
  bashMobs: 0,
  hours: 0,
  group: 0,
}

export const GUIDE_SECTIONS: { id: GuideSection; label: string }[] = [
  { id: "dofus", label: "Les Dofus" },
  { id: "secondaires", label: "Dofus secondaires" },
  { id: "alignement", label: "Alignement" },
  { id: "evenements", label: "Événements" },
  { id: "fusion", label: "Fusion de progressions" },
]

const GAINS = gainsCatalog as Record<string, GuideGains>
const GUIDES: GuideDefinition[] = (catalog as { guides: GuideDefinition[] }).guides.map((guide) => {
  const gains = GAINS[guide.slug]
  return gains ? { ...guide, gains } : guide
})

export function allGuides(): GuideDefinition[] {
  return GUIDES
}

export function getGuide(slug: string): GuideDefinition | undefined {
  return GUIDES.find((guide) => guide.slug === slug)
}

export function guidesForQuest(questId: number): GuideDefinition[] {
  return GUIDES.filter((guide) => guide.questIds.includes(questId))
}

export function guideProgress(guide: GuideDefinition, done: DoneMap) {
  const total = guide.questIds.length
  const doneCount = guide.questIds.filter((id) => done[String(id)]).length
  return {
    done: doneCount,
    total,
    pct: total > 0 ? Math.round((doneCount / total) * 100) : 0,
  }
}

export function guideIconUrl(guide: Pick<GuideDefinition, "iconId">): string | null {
  if (!guide.iconId || guide.iconId <= 0) return null
  return `https://api.dofusdb.fr/img/items/${guide.iconId}.png`
}

export function formatGuideLevel(min: number, max: number): string {
  if (!min && !max) return "Tous niveaux"
  if (!max || min === max) return `Niv. ${min}`
  return `Niv. ${min} à ${max}`
}

export function guideChapters(guide: Pick<GuideDefinition, "title" | "questIds" | "chapters">): GuideChapter[] {
  if (guide.chapters?.length) return guide.chapters
  return [{ title: guide.title, questIds: guide.questIds }]
}

export function countDone(ids: number[], done: DoneMap) {
  return ids.filter((id) => done[String(id)]).length
}

export function chapterGroups(chapters: GuideChapter[]) {
  const prereq = chapters.filter((chapter) => chapter.kind === "prereq")
  const main = chapters.filter((chapter) => chapter.kind === "main")
  const other = chapters.filter((chapter) => chapter.kind !== "prereq" && chapter.kind !== "main")
  return { prereq, main, other }
}

export function chapterIndexForQuest(chapters: GuideChapter[], questId: number) {
  return chapters.findIndex((chapter) => chapter.questIds.includes(questId))
}

export function firstOpenQuest(ids: number[], done: DoneMap, skipDone: boolean) {
  if (!skipDone) return ids[0] ?? null
  return ids.find((id) => !done[String(id)]) ?? ids[0] ?? null
}

export function adjacentChapterIndex(chapters: GuideChapter[], current: number, direction: 1 | -1) {
  const next = current + direction
  if (next < 0 || next >= chapters.length) return null
  return next
}

export function gainsTotalKamas(gains: Pick<GuideGains, "kamasQuest" | "kamasAchievement">) {
  return gains.kamasQuest + gains.kamasAchievement
}

/** Tougli headline: French grouping + a kamas suffix, e.g. 173 685k. */
export function formatTougliKamas(value: number): string {
  const grouped = new Intl.NumberFormat("fr-FR").format(value).replace(/\u202f|\u00a0/g, "\u00a0")
  return `${grouped}k`
}

export function countGainsCounters(
  gains: Pick<GuideGains, "counters" | "countersByQuest">,
  done: DoneMap,
): { done: GuideObjectiveCounters; total: GuideObjectiveCounters } {
  const doneCounters = { ...EMPTY_COUNTERS }
  for (const [questId, counts] of Object.entries(gains.countersByQuest)) {
    if (!done[questId]) continue
    for (const kind of OBJECTIVE_COUNTERS) {
      doneCounters[kind.id] += counts[kind.id] ?? 0
    }
  }
  return { done: doneCounters, total: { ...EMPTY_COUNTERS, ...gains.counters } }
}
