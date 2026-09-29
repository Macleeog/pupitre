import { useEffect, useState } from "react";
import { usePupitre } from "@/lib/pupitre/store";
import type { NetState } from "@/pupitre-desktop";

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

// Only the desk window listens: the overlay mirrors the farm through BroadcastChannel,
// so counting in both would add every fight twice.
export function bindGameEvents(): () => void {
  const off = window.pupitre?.net?.onGameEvent((event) => {
    if (event.type !== "fight-end") return;
    const { autoCombats, farm, addCombat } = usePupitre.getState();
    if (autoCombats && farm.status === "running") addCombat();
  });
  return () => off?.();
}
