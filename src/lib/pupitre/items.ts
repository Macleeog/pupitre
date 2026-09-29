export type CatalogItem = {
  id: number;
  name: string;
  level: number;
  typeName: string;
  icon: string;
  price: number;
};

type Localized = { fr?: string } | string | null | undefined;

function french(value: Localized): string {
  if (typeof value === "string") return value;
  if (value && typeof value.fr === "string") return value.fr;
  return "";
}

export function foldItemQuery(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchItems(query: string, signal: AbortSignal): Promise<CatalogItem[]> {
  const folded = foldItemQuery(query);
  if (folded.length < 2) return [];
  const params = new URLSearchParams();
  params.set("slug.fr[$search]", folded);
  params.set("$limit", "8");
  params.set("lang", "fr");
  const response = await fetch(`https://api.dofusdb.fr/items?${params}`, { signal });
  if (!response.ok) throw new Error("dofusdb");
  const body = (await response.json()) as { data?: unknown[] };
  const rows = Array.isArray(body.data) ? body.data : [];
  const items = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as {
      id?: number;
      name?: Localized;
      level?: number;
      img?: string;
      price?: number;
      type?: { name?: Localized };
    };
    const name = french(item.name);
    if (!item.id || !name) return [];
    return [
      {
        id: item.id,
        name,
        level: typeof item.level === "number" ? item.level : 0,
        typeName: french(item.type?.name),
        icon: typeof item.img === "string" ? item.img : "",
        price: typeof item.price === "number" ? item.price : 0,
      },
    ];
  });
  const needle = folded;
  return items.sort((a, b) => {
    const aStart = foldItemQuery(a.name).startsWith(needle) ? 0 : 1;
    const bStart = foldItemQuery(b.name).startsWith(needle) ? 0 : 1;
    if (aStart !== bStart) return aStart - bStart;
    return a.level - b.level || a.name.localeCompare(b.name, "fr");
  });
}

const byId = new Map<number, Promise<CatalogItem | null>>();

export function fetchItem(id: number): Promise<CatalogItem | null> {
  let pending = byId.get(id);
  if (!pending) {
    pending = fetch(`https://api.dofusdb.fr/items/${id}?lang=fr`)
      .then(async (response) => {
        if (!response.ok) throw new Error("dofusdb");
        const item = (await response.json()) as {
          name?: Localized;
          level?: number;
          img?: string;
          price?: number;
          type?: { name?: Localized };
        };
        const name = french(item.name);
        if (!name) return null;
        return {
          id,
          name,
          level: typeof item.level === "number" ? item.level : 0,
          typeName: french(item.type?.name),
          icon: typeof item.img === "string" ? item.img : "",
          price: typeof item.price === "number" ? item.price : 0,
        };
      })
      .catch(() => {
        byId.delete(id);
        return null;
      });
    byId.set(id, pending);
  }
  return pending;
}
