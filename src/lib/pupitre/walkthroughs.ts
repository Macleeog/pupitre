import catalog from "@/data/walkthroughs.json"
import type { Walkthrough } from "@/lib/pupitre/walkthrough-parse"

const BY_ID = catalog as Record<string, Walkthrough>

export function getWalkthrough(questId: number): Walkthrough | null {
  return BY_ID[String(questId)] ?? null
}

export function walkthroughCount(): number {
  return Object.keys(BY_ID).length
}

export function walkthroughQuestIds(): number[] {
  return Object.keys(BY_ID).map(Number).filter((id) => Number.isInteger(id) && id > 0)
}

export function questStartPin(questId: number): { zone: string | null; x: number | null; y: number | null; npc: string | null } {
  const walkthrough = getWalkthrough(questId)
  return {
    zone: walkthrough?.zone ?? null,
    x: walkthrough?.startX ?? null,
    y: walkthrough?.startY ?? null,
    npc: walkthrough?.startNpc ?? null,
  }
}
