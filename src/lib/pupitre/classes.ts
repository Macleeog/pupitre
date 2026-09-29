export const CLASS_IDS = [
  "feca",
  "osamodas",
  "enutrof",
  "sram",
  "xelor",
  "ecaflip",
  "eniripsa",
  "iop",
  "cra",
  "sadida",
  "sacrieur",
  "pandawa",
  "roublard",
  "zobal",
  "steamer",
  "eliotrope",
  "huppermage",
  "ouginak",
  "forgelance",
] as const;

export type ClassId = (typeof CLASS_IDS)[number];

export type ClassInfo = {
  id: ClassId;
  name: string;
  hint: string;
};

export const CLASSES: readonly ClassInfo[] = [
  { id: "feca", name: "Féca", hint: "glyphes" },
  { id: "osamodas", name: "Osamodas", hint: "invocations" },
  { id: "enutrof", name: "Enutrof", hint: "prospection" },
  { id: "sram", name: "Sram", hint: "invisibilité" },
  { id: "xelor", name: "Xélor", hint: "tempo" },
  { id: "ecaflip", name: "Ecaflip", hint: "chance" },
  { id: "eniripsa", name: "Eniripsa", hint: "soins" },
  { id: "iop", name: "Iop", hint: "mêlée" },
  { id: "cra", name: "Crâ", hint: "distance" },
  { id: "sadida", name: "Sadida", hint: "plantes" },
  { id: "sacrieur", name: "Sacrieur", hint: "sacrifice" },
  { id: "pandawa", name: "Pandawa", hint: "placement" },
  { id: "roublard", name: "Roublard", hint: "bombes" },
  { id: "zobal", name: "Zobal", hint: "masques" },
  { id: "steamer", name: "Steamer", hint: "tourelles" },
  { id: "eliotrope", name: "Eliotrope", hint: "portails" },
  { id: "huppermage", name: "Huppermage", hint: "éléments" },
  { id: "ouginak", name: "Ouginak", hint: "rage" },
  { id: "forgelance", name: "Forgelance", hint: "lance" },
];

export function classById(id: ClassId): ClassInfo {
  const found = CLASSES.find((entry) => entry.id === id);
  return found ?? CLASSES[0];
}
