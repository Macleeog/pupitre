import { useEffect, useState } from "react";
import { fetchItem } from "@/lib/pupitre/items";
import { usePupitre } from "@/lib/pupitre/store";
import type { FightEnd, FightResult, NetState } from "@/pupitre-desktop";

export function useNetState(): NetState | null {
  const [state, setState] = useState<NetState | null>(null);
  useEffect(() => {
    const net = window.pupitre?.net;
    if (!net) return;
    let alive = true;
    void net.getState().then((initial) => {
      if (alive && initial) setState(initial);
    });
    const off = net.onState(setState);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}

export function hasLoot(result: FightResult): boolean {
  return result.kamas > 0 || result.items.length > 0;
}

// `mine` comes from the reader: set for the characters played from this PC, or for the only
// rewarded fighter when none is known yet.
export function fightLoot(event: FightEnd) {
  const quantities = new Map<number, number>();
  let kamas = 0;
  const results = event.results ?? [];
  for (const result of results) {
    if (!result.mine) continue;
    kamas += result.kamas;
    for (const { itemId, quantity } of result.items) {
      quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);
    }
  }
  const unattributed = !results.some((result) => result.mine) && results.some(hasLoot);
  return { kamas, items: [...quantities].map(([itemId, quantity]) => ({ itemId, quantity })), unattributed };
}

async function nameNewResources(resourceIds: string[]) {
  for (const resourceId of resourceIds) {
    const resource = usePupitre.getState().farm.resources.find((entry) => entry.id === resourceId);
    if (!resource?.itemId) continue;
    const item = await fetchItem(resource.itemId);
    if (!item) continue;
    const current = usePupitre.getState().farm.resources.find((entry) => entry.id === resourceId);
    const catalogPrice = !current?.price && item.price > 1;
    usePupitre.getState().patchResource(resourceId, {
      name: item.name,
      itemId: item.id,
      icon: item.icon,
      typeName: item.typeName,
      level: item.level,
      price: catalogPrice ? String(item.price) : undefined,
      priceFrom: catalogPrice ? "catalog" : undefined,
    });
  }
}

// Only the desk window listens: the overlay mirrors the farm through BroadcastChannel,
// so counting in both would add every fight twice.
export function bindGameEvents(): () => void {
  const off = window.pupitre?.net?.onGameEvent((event) => {
    if (event.type === "hdv-prices") {
      usePupitre.getState().applyHdvPrices(event.prices, event.at);
      return;
    }
    if (event.type !== "fight-end") return;
    const { autoCombats, autoLoot, farm, addCombat, addFightLoot } = usePupitre.getState();
    if (farm.status !== "running") return;
    if (autoCombats) addCombat();
    if (autoLoot) {
      const loot = fightLoot(event);
      if (loot.kamas > 0 || loot.items.length > 0) void nameNewResources(addFightLoot(loot.kamas, loot.items));
    }
  });
  return () => off?.();
}
