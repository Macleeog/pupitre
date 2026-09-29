import { useEffect, useState } from "react";
import { fetchItem } from "@/lib/pupitre/items";
import { usePupitre } from "@/lib/pupitre/store";
import type { FightEnd, NetState } from "@/pupitre-desktop";

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

export function fightLoot(event: FightEnd) {
  const quantities = new Map<number, number>();
  let kamas = 0;
  for (const result of event.results ?? []) {
    kamas += result.kamas;
    for (const { itemId, quantity } of result.items) {
      quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);
    }
  }
  return { kamas, items: [...quantities].map(([itemId, quantity]) => ({ itemId, quantity })) };
}

async function nameNewResources(resourceIds: string[]) {
  for (const resourceId of resourceIds) {
    const resource = usePupitre.getState().farm.resources.find((entry) => entry.id === resourceId);
    if (!resource?.itemId) continue;
    const item = await fetchItem(resource.itemId);
    if (!item) continue;
    usePupitre.getState().patchResource(resourceId, {
      name: item.name,
      itemId: item.id,
      icon: item.icon,
      typeName: item.typeName,
      level: item.level,
      price: item.price > 1 ? String(item.price) : undefined,
    });
  }
}

// Only the desk window listens: the overlay mirrors the farm through BroadcastChannel,
// so counting in both would add every fight twice.
export function bindGameEvents(): () => void {
  const off = window.pupitre?.net?.onGameEvent((event) => {
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
