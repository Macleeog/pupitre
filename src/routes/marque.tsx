import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GameDiamond } from "@/components/pupitre/cell-sketch";
import { useCalib, useHarebourgState } from "@/lib/pupitre/harebourg-client";
import { loadWatchSettings } from "@/lib/pupitre/watch-settings";

export const Route = createFileRoute("/marque")({
  component: MarquePage,
});

function MarquePage() {
  const { state } = useHarebourgState();
  const { calib } = useCalib();
  const [enabled, setEnabled] = useState(true);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.backgroundImage = "none";
    setEnabled(loadWatchSettings().harebourg);
    const read = () => setBox({ width: window.innerWidth, height: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    const onSettings = () => setEnabled(loadWatchSettings().harebourg);
    window.addEventListener("pupitre-watch-settings", onSettings);
    const channel = new BroadcastChannel("pupitre-watch-settings");
    channel.addEventListener("message", onSettings);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("pupitre-watch-settings", onSettings);
      channel.removeEventListener("message", onSettings);
      channel.close();
    };
  }, []);

  const mark = enabled && state?.active && !state.unidentified ? state.mark : null;
  if (!mark) return null;
  return (
    <main className="pointer-events-none fixed inset-0">
      <GameDiamond point={{ x: mark.x, y: mark.y }} width={box.width} height={box.height} calib={calib} />
    </main>
  );
}
