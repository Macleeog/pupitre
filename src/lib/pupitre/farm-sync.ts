import type { FarmSession } from "@/lib/pupitre/farm";
import { usePupitre, type FarmHistoryEntry } from "@/lib/pupitre/store";
import type { FarmCommand } from "@/pupitre-desktop";

type FarmMessage = {
  farm: FarmSession;
  farmHistory: FarmHistoryEntry[];
};

export function bindFarmSync(): () => void {
  const channel = new BroadcastChannel("pupitre-farm");
  let applying = false;
  const onMessage = (event: MessageEvent<FarmMessage>) => {
    if (!event.data?.farm || !event.data.farmHistory) return;
    applying = true;
    usePupitre.setState({ farm: event.data.farm, farmHistory: event.data.farmHistory });
    applying = false;
  };
  channel.addEventListener("message", onMessage);
  const unsubscribe = usePupitre.subscribe((state, previous) => {
    if (applying) return;
    if (state.farm === previous.farm && state.farmHistory === previous.farmHistory) return;
    const message: FarmMessage = { farm: state.farm, farmHistory: state.farmHistory };
    channel.postMessage(message);
  });
  return () => {
    unsubscribe();
    channel.removeEventListener("message", onMessage);
    channel.close();
  };
}

export function applyFarmCommand(command: FarmCommand) {
  const { startFarm, pauseFarm, finishFarm, resetFarm, addCombat } = usePupitre.getState();
  if (command === "start") startFarm();
  if (command === "pause") pauseFarm();
  if (command === "stop") finishFarm();
  if (command === "reset") resetFarm();
  if (command === "combat") addCombat();
}

export function bindFarmHotkeys(): () => void {
  const off = window.pupitre?.onFarmCommand(applyFarmCommand);
  return () => off?.();
}
