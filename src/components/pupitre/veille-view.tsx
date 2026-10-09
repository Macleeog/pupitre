import { useEffect, useState } from "react";
import { CellSketch } from "@/components/pupitre/cell-sketch";
import { useCalib, useHarebourgState, type HarebourgFighter } from "@/lib/pupitre/harebourg-client";
import { DEFAULT_CALIB } from "@/lib/pupitre/cell-screen";
import {
  copyTravel,
  loadWatchSettings,
  otherWorld,
  pushWatchSettings,
  rememberSighting,
  saveWatchSettings,
  travelFor,
  visibleSightings,
  type WatchSettings,
  type WatchSighting,
} from "@/lib/pupitre/watch-settings";

const PORTRAIT = "https://api.dofusdb.fr/img/monsters/993.png";

function isSighting(value: unknown): value is WatchSighting {
  if (!value || typeof value !== "object") return false;
  const row = value as WatchSighting;
  return row.at > 0 && typeof row.text === "string" && Array.isArray(row.monsters);
}

export function VeilleView() {
  const [settings, setSettings] = useState<WatchSettings | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const harebourg = useHarebourgState();

  useEffect(() => {
    const initial = loadWatchSettings();
    setSettings(initial);
    pushWatchSettings(initial);
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    const off = window.pupitre?.net?.onGameEvent((event) => {
      if (!isSighting(event)) return;
      const next = rememberSighting(loadWatchSettings(), event);
      saveWatchSettings(next);
      setSettings(next);
    });
    return () => {
      window.clearInterval(timer);
      off?.();
    };
  }, []);

  if (!settings) return <p className="text-sm text-mist">Chargement de la veille…</p>;

  const update = (patch: Partial<WatchSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveWatchSettings(next);
    pushWatchSettings(next);
  };
  const sightings = visibleSightings(settings, now);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-card border border-edge bg-moss p-4">
        <h2 className="font-medium text-fog">Archimonstres et avis de recherche</h2>
        <p className="mt-1 text-sm text-mist">
          Pupitre lit la carte et le chat. Il affiche le portrait et, sur le monde principal, copie{" "}
          <span className="text-fog">/travel</span>. Il n'envoie rien au jeu.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Toggle
            checked={settings.archiNotices}
            onChange={(archiNotices) => update({ archiNotices })}
            label="Archimonstres"
          />
          <Toggle
            checked={settings.wantedNotices}
            onChange={(wantedNotices) => update({ wantedNotices })}
            label="Avis de recherche"
          />
        </div>
        {sightings.length === 0 ? (
          <p className="mt-4 text-sm text-mist">Aucune alerte sur les dix dernières minutes.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {sightings.map((sighting) => (
              <SightingRow key={`${sighting.at}-${sighting.text}`} sighting={sighting} />
            ))}
          </ul>
        )}
      </section>

      <HarebourgCard
        enabled={settings.harebourg}
        onEnabled={(harebourgEnabled) => update({ harebourg: harebourgEnabled })}
        state={harebourg.state}
        hovered={harebourg.hovered}
        onHover={harebourg.setHovered}
      />
      <p className="text-xs text-mist">Données issues de DofusDB. Utilisation soumise à la LPNC-IA 1.0.</p>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 flex-1 items-center gap-3 rounded-xl border border-edge bg-pine px-3 text-sm text-fog">
      <input
        type="checkbox"
        className="size-4 accent-[#b7dc69]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function SightingRow({ sighting }: { sighting: WatchSighting }) {
  const [copied, setCopied] = useState(false);
  const command = travelFor(sighting.coords);
  const monster = sighting.monsters[0];
  const portrait = monster?.gfxId ? `https://api.dofusdb.fr/img/monsters/${monster.gfxId}.png` : "";
  return (
    <li className="flex items-center gap-3 rounded-xl border border-edge bg-pine p-2">
      {portrait ? <img src={portrait} alt="" className="size-14 rounded-lg bg-moss object-contain" /> : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fog">{sighting.text}</p>
        <p className="text-xs text-mist">{monster?.kind === "archi" ? "Archimonstre" : "Avis de recherche"}</p>
      </div>
      {command ? (
        <button
          type="button"
          className="shrink-0 rounded-full bg-lamp px-3 py-2 text-xs font-medium text-lamp-ink"
          onClick={() => {
            void copyTravel(command).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          {copied ? "Copié" : command}
        </button>
      ) : otherWorld(sighting.coords) ? (
        <span className="shrink-0 text-xs text-mist">Autre monde</span>
      ) : (
        <span className="shrink-0 text-xs text-mist">Position inconnue</span>
      )}
    </li>
  );
}

function HarebourgCard({
  enabled,
  onEnabled,
  state,
  hovered,
  onHover,
}: {
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  state: ReturnType<typeof useHarebourgState>["state"];
  hovered: string | null;
  onHover: (id: string | null) => void;
}) {
  const { calib, update } = useCalib();
  const followed = state?.fighters.find((fighter) => fighter.id === state.followedId) ?? null;
  const preview = state?.fighters.find((fighter) => fighter.id === hovered) ?? followed;
  const nudge = (ox: number, oy: number) => update({ ...calib, ox: calib.ox + ox, oy: calib.oy + oy });

  return (
    <section className="rounded-card border border-edge bg-moss p-4">
      <div className="flex items-start gap-3">
        <img src={PORTRAIT} alt="" className="size-16 rounded-xl bg-pine object-contain" />
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-fog">Comte Harebourg</h2>
          <p className="mt-1 text-sm text-mist">
            La case verte est dessinée sur la fenêtre Dofus du personnage reconnu. Si Pupitre ne sait pas qui tu joues,
            aucune case n'est dessinée.
          </p>
        </div>
      </div>
      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm text-fog">
        <input
          type="checkbox"
          className="size-4 accent-[#b7dc69]"
          checked={enabled}
          onChange={(event) => onEnabled(event.target.checked)}
        />
        Dessiner la case sur le jeu
      </label>

      {!state?.active ? (
        <p className="mt-3 text-sm text-mist">En attente d'un combat contre le Comte.</p>
      ) : state.unidentified || !followed ? (
        <p className="mt-3 text-sm text-fog">Personnage non identifié. Aucune case n'est dessinée sur le jeu.</p>
      ) : (
        <FighterLine fighter={preview ?? followed} followed={followed} hovered={hovered !== null && hovered !== followed.id} />
      )}

      {state && state.fighters.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {state.fighters.map((fighter) => (
            <button
              key={fighter.id}
              type="button"
              onMouseEnter={() => onHover(fighter.id)}
              onMouseLeave={() => onHover(null)}
              className={
                "rounded-full border px-3 py-1 text-xs " +
                (fighter.id === state.followedId ? "border-lamp text-lamp" : "border-edge text-mist")
              }
            >
              {fighter.name ?? "Allié"}
              {fighter.id === state.followedId ? " · joué" : ""}
            </button>
          ))}
        </div>
      ) : null}
      {hovered && followed && hovered !== followed.id ? (
        <p className="mt-2 text-xs text-mist">
          Aperçu de {preview?.name ?? "cet allié"}. La marque sur le jeu reste celle de {followed.name ?? "ton personnage"}.
        </p>
      ) : null}

      <CellSketch
        playerCell={preview?.cell ?? null}
        comteCell={state?.comteCell ?? null}
        aimCell={preview?.aimCell ?? null}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-mist">Calage, le même pour tout le monde</span>
        <CalibButton label="←" onClick={() => nudge(-10, 0)} />
        <CalibButton label="→" onClick={() => nudge(10, 0)} />
        <CalibButton label="↑" onClick={() => nudge(0, -10)} />
        <CalibButton label="↓" onClick={() => nudge(0, 10)} />
        <CalibButton label="+" onClick={() => update({ ...calib, sx: calib.sx + 2 })} />
        <CalibButton label="−" onClick={() => update({ ...calib, sx: calib.sx - 2 })} />
        <button type="button" className="min-h-9 px-2 text-xs text-mist" onClick={() => update(DEFAULT_CALIB)}>
          Réinitialiser
        </button>
      </div>
    </section>
  );
}

function FighterLine({
  fighter,
  followed,
  hovered,
}: {
  fighter: HarebourgFighter;
  followed: HarebourgFighter;
  hovered: boolean;
}) {
  const name = fighter.name ?? "Personnage";
  return (
    <div className="mt-3">
      <p className="text-sm text-fog">
        {name}
        {hovered ? "" : " · joué"} · {fighter.rotation ?? "vie inconnue"}
      </p>
      <p className="text-sm text-lamp">
        {fighter.aim ?? "Pas de visée tant que les points de vie ne sont pas lus"}
        {fighter.aimCell !== null ? ` · case ${fighter.aimCell}` : ""}
      </p>
      {fighter.id !== followed.id ? null : (
        <p className="mt-1 text-xs text-mist">Le panneau nomme le personnage. La case verte est sur sa fenêtre.</p>
      )}
    </div>
  );
}

function CalibButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid size-9 place-items-center rounded-full border border-edge text-sm text-fog"
    >
      {label}
    </button>
  );
}
