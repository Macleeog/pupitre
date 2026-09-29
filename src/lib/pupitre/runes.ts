export type RuneEdition = "unity" | "retro";

export type RuneFamilyId = "heavy" | "damage" | "resistance" | "secondary" | "primary";

export type RuneTier = {
  bonus: number;
  weight: number;
};

export type RuneStat = {
  id: string;
  name: string;
  short: string;
  family: RuneFamilyId;
  unit: number;
  over: number | null;
  rune: RuneTier;
  pa: RuneTier | null;
  ra: RuneTier | null;
};

export const FAMILY_ORDER: readonly RuneFamilyId[] = [
  "heavy",
  "damage",
  "resistance",
  "secondary",
  "primary",
];

export const FAMILY_LABEL: Record<RuneFamilyId, string> = {
  heavy: "Lourdes",
  damage: "Dommages",
  resistance: "Résistances",
  secondary: "Secondaires",
  primary: "Légères",
};

const tier = (bonus: number, weight: number): RuneTier => ({ bonus, weight });

/**
 * Poids du client Unity (lignée Dofus 2 / 3.0), pas l'arrondi Rétro.
 * L'over théorique est le nombre de points ajoutables pour ~101 de poids, sans puits.
 */
export const UNITY_RUNES: readonly RuneStat[] = [
  stat("ap", "Points d'action", "PA", "heavy", 100, 1, tier(1, 100), null, null),
  stat("mp", "Points de mouvement", "PM", "heavy", 90, 1, tier(1, 90), null, null),
  stat("range", "Portée", "PO", "heavy", 51, 1, tier(1, 51), null, null),
  stat("summon", "Invocation", "Invo", "heavy", 30, 3, tier(1, 30), null, null),
  stat("damage", "Dommages", "Do", "damage", 20, 5, tier(1, 20), null, null),
  stat("element", "Do terre / feu / eau / air / neutre", "Do élém.", "damage", 5, 20, tier(1, 5), tier(3, 15), null),
  stat("crit-dmg", "Dommages critiques", "Do cri", "damage", 5, 20, tier(1, 5), tier(3, 15), null),
  stat("push-dmg", "Dommages de poussée", "Do pou", "damage", 5, 20, tier(1, 5), tier(3, 15), null),
  stat("trap-dmg", "Dommages pièges", "Do piège", "damage", 15, 6, tier(1, 15), tier(3, 45), null),
  stat("trap-pow", "Puissance des pièges", "Pui piège", "damage", 2, 50, tier(1, 2), tier(3, 6), tier(10, 20)),
  stat("heal", "Soins", "Soin", "damage", 10, 10, tier(1, 10), tier(3, 30), null),
  stat("reflect", "Renvoi de dommages", "Renvoi", "damage", 10, 10, tier(1, 10), null, null),
  stat("crit", "Coups critiques", "Cri", "damage", 10, 10, tier(1, 10), null, null),
  stat("res-pct", "% résistance T / F / E / A / N", "% rés.", "resistance", 6, 16, tier(1, 6), null, null),
  stat("res-flat", "Résistance fixe", "Rés. fixe", "resistance", 2, 50, tier(1, 2), tier(3, 6), tier(10, 20)),
  stat("res-crit", "Résistance critique", "Rés. cri", "resistance", 2, 50, tier(1, 2), tier(3, 6), null),
  stat("res-push", "Résistance poussée", "Rés. pou", "resistance", 2, 50, tier(1, 2), tier(3, 6), null),
  stat("wisdom", "Sagesse", "Sasa", "secondary", 3, 33, tier(1, 3), tier(3, 9), tier(10, 30)),
  stat("pp", "Prospection", "Prospe", "secondary", 3, 33, tier(1, 3), tier(3, 9), null),
  stat("power", "Puissance", "Pui", "secondary", 2, 50, tier(1, 2), tier(3, 6), tier(10, 20)),
  stat("lock", "Tacle", "Tacle", "secondary", 4, 25, tier(1, 4), tier(3, 12), null),
  stat("dodge", "Fuite", "Fuite", "secondary", 4, 25, tier(1, 4), tier(3, 12), null),
  stat("ap-red", "Retrait PA", "Ret. PA", "secondary", 7, 14, tier(1, 7), tier(3, 21), null),
  stat("mp-red", "Retrait PM", "Ret. PM", "secondary", 7, 14, tier(1, 7), tier(3, 21), null),
  stat("ap-dodge", "Esquive PA", "Esq. PA", "secondary", 7, 14, tier(1, 7), tier(3, 21), null),
  stat("mp-dodge", "Esquive PM", "Esq. PM", "secondary", 7, 14, tier(1, 7), tier(3, 21), null),
  stat("hunt", "Chasse", "Chasse", "secondary", 5, null, tier(1, 5), null, null),
  stat("elements", "Force / intelligence / chance / agilité", "Fo Ine Cha Age", "primary", 1, 101, tier(1, 1), tier(3, 3), tier(10, 10)),
  stat("vita", "Vitalité", "Vita", "primary", 0.2, 505, tier(5, 1), tier(15, 3), tier(50, 10)),
  stat("pods", "Pods", "Pods", "primary", 0.25, 404, tier(10, 2.5), tier(30, 7.5), tier(100, 25)),
  stat("ini", "Initiative", "Ini", "primary", 0.1, 1010, tier(10, 1), tier(30, 3), tier(100, 10)),
];

/**
 * Table Rétro, mêmes poids que le paquet `runes` de Multifus :
 * le critique pèse 30, le soin 20, la vita est arrondie (Ra à 8).
 */
export const RETRO_RUNES: readonly RuneStat[] = [
  stat("ap", "Points d'action", "PA", "heavy", 100, null, tier(1, 100), null, null),
  stat("mp", "Points de mouvement", "PM", "heavy", 90, null, tier(1, 90), null, null),
  stat("range", "Portée", "PO", "heavy", 51, null, tier(1, 51), null, null),
  stat("summon", "Invocation", "Invo", "heavy", 30, null, tier(1, 30), null, null),
  stat("crit", "Coups critiques", "Cri", "heavy", 30, null, tier(1, 30), null, null),
  stat("heal", "Soins", "Soin", "heavy", 20, null, tier(1, 20), null, null),
  stat("reflect", "Renvoi de dommages", "Renvoi", "damage", 30, null, tier(1, 30), null, null),
  stat("damage", "Dommages", "Do", "damage", 20, null, tier(1, 20), null, null),
  stat("trap-dmg", "Dommages pièges", "Do piège", "damage", 15, null, tier(1, 15), tier(3, 45), null),
  stat("trap-pow", "% pièges", "% piège", "damage", 2, null, tier(1, 2), tier(3, 6), null),
  stat("dmg-pct", "% dommages", "% do", "damage", 2, null, tier(1, 2), tier(3, 6), tier(10, 20)),
  stat("res-pct", "% résistance", "% rés.", "resistance", 4, null, tier(1, 4), null, null),
  stat("res-flat", "Résistance fixe", "Rés. fixe", "resistance", 5, null, tier(1, 5), null, null),
  stat("wisdom", "Sagesse", "Sasa", "secondary", 3, null, tier(1, 3), tier(3, 9), tier(10, 30)),
  stat("pp", "Prospection", "Prospe", "secondary", 3, null, tier(1, 3), tier(3, 9), null),
  stat("hunt", "Chasse", "Chasse", "secondary", 5, null, tier(1, 5), null, null),
  stat("elements", "Force / intelligence / chance / agilité", "Ine Fo Age Cha", "primary", 1, null, tier(1, 1), tier(3, 3), tier(10, 10)),
  stat("ini", "Initiative", "Ini", "primary", 0.1, null, tier(10, 1), tier(30, 3), tier(100, 10)),
  stat("vita", "Vitalité", "Vita", "primary", 0.25, null, tier(3, 1), tier(10, 3), tier(30, 8)),
  stat("pods", "Pods", "Pods", "primary", 0.25, null, tier(10, 3), tier(30, 8), tier(100, 25)),
];

function stat(
  id: string,
  name: string,
  short: string,
  family: RuneFamilyId,
  unit: number,
  over: number | null,
  rune: RuneTier,
  pa: RuneTier | null,
  ra: RuneTier | null,
): RuneStat {
  return { id, name, short, family, unit, over, rune, pa, ra };
}

export function runesFor(edition: RuneEdition): readonly RuneStat[] {
  return edition === "unity" ? UNITY_RUNES : RETRO_RUNES;
}

export function formatWeight(weight: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(weight);
}

export type RuneGrade = "rune" | "pa" | "ra";

export function gradeOf(stat: RuneStat, grade: RuneGrade): RuneTier | null {
  if (grade === "rune") return stat.rune;
  if (grade === "pa") return stat.pa;
  return stat.ra;
}
