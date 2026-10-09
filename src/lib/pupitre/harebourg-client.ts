import { useCallback, useEffect, useState } from "react";
import { DEFAULT_CALIB, sanitizeCalib, type Calib } from "@/lib/pupitre/cell-screen";

const ENABLED_CHANNEL = "pupitre-harebourg-settings";
const CALIB_KEY = "pupitre-harebourg-calib-v1";
const CALIB_CHANNEL = "pupitre-harebourg-calib";

export type HarebourgFighter = {
  id: string;
  name: string | null;
  cell: number | null;
  life: number | null;
  lifeMax: number | null;
  melee: number;
  rotation: string | null;
  aim: string | null;
  aimCell: number | null;
};

export type HarebourgState = {
  type: "harebourg-state";
  at: number;
  active: boolean;
  gfxId: number;
  comteCell: number | null;
  followedId: string | null;
  unidentified: boolean;
  fighters: HarebourgFighter[];
  gap: { id: string; had: number; from: number; to: number } | null;
  mark: { cell: number; x: number; y: number; name: string | null } | null;
  dofusWindow: { x: number; y: number; width: number; height: number } | null;
};

export function isHarebourgState(value: unknown): value is HarebourgState {
  if (!value || typeof value !== "object") return false;
  const row = value as HarebourgState;
  return row.type === "harebourg-state" && Array.isArray(row.fighters);
}

export function useHarebourgState() {
  const [state, setState] = useState<HarebourgState | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const apply = (value: unknown) => {
      if (isHarebourgState(value)) setState(value);
    };
    const net = window.pupitre?.net;
    if (net) {
      void net.getState().then((snap) => apply(snap?.harebourg));
      const off = net.onGameEvent((event) => apply(event));
      return () => off();
    }
    return undefined;
  }, []);

  return { state, hovered, setHovered };
}

function readCalib() {
  try {
    return sanitizeCalib(JSON.parse(localStorage.getItem(CALIB_KEY) ?? "")) ?? DEFAULT_CALIB;
  } catch {
    return DEFAULT_CALIB;
  }
}

export function useCalib() {
  const [calib, setCalib] = useState<Calib>(DEFAULT_CALIB);

  useEffect(() => {
    setCalib(readCalib());
    const apply = (value: unknown) => {
      const next = sanitizeCalib(value);
      if (next) setCalib(next);
    };
    const onLocal = (event: Event) => apply((event as CustomEvent).detail);
    window.addEventListener("pupitre-harebourg-calib", onLocal);
    const channel = new BroadcastChannel(CALIB_CHANNEL);
    const onMessage = (event: MessageEvent) => apply(event.data);
    channel.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("pupitre-harebourg-calib", onLocal);
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
  }, []);

  const update = useCallback((next: Calib) => {
    const clean = sanitizeCalib(next) ?? DEFAULT_CALIB;
    setCalib(clean);
    localStorage.setItem(CALIB_KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent("pupitre-harebourg-calib", { detail: clean }));
    const channel = new BroadcastChannel(CALIB_CHANNEL);
    channel.postMessage(clean);
    channel.close();
  }, []);

  return { calib, update };
}

export { ENABLED_CHANNEL };
