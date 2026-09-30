import { useEffect, useState } from "react";
import type { UpdateState } from "@/pupitre-desktop";

export function useUpdateState(): UpdateState | null {
  const [state, setState] = useState<UpdateState | null>(null);
  useEffect(() => {
    const updates = window.pupitre?.updates;
    if (!updates) return;
    let alive = true;
    void updates.getState().then((initial) => {
      if (alive && initial) setState(initial);
    });
    const off = updates.onState(setState);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return state;
}
