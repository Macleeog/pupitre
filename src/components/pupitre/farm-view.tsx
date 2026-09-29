import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  averageMs,
  elapsedMs,
  formatDecimal,
  formatDuration,
  formatKamas,
  parseKamas,
  perHour,
  snapshot,
  type FarmStatus,
} from "@/lib/pupitre/farm";
import { searchItems, type CatalogItem } from "@/lib/pupitre/items";
import { usePupitre, type FarmHistoryEntry } from "@/lib/pupitre/store";
import type { FarmResource } from "@/lib/pupitre/farm";

const STATUS_LABEL: Record<FarmStatus, string> = {
  idle: "Prêt à démarrer",
  running: "En cours",
  paused: "En pause",
  done: "Terminée",
};

export function FarmView() {
  const farm = usePupitre((state) => state.farm);
  const history = usePupitre((state) => state.farmHistory);
  const patchFarm = usePupitre((state) => state.patchFarm);
  const startFarm = usePupitre((state) => state.startFarm);
  const pauseFarm = usePupitre((state) => state.pauseFarm);
  const finishFarm = usePupitre((state) => state.finishFarm);
  const addCombat = usePupitre((state) => state.addCombat);
  const addDonjon = usePupitre((state) => state.addDonjon);
  const addResource = usePupitre((state) => state.addResource);
  const patchResource = usePupitre((state) => state.patchResource);
  const removeResource = usePupitre((state) => state.removeResource);
  const removeFarmHistory = usePupitre((state) => state.removeFarmHistory);
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (farm.status !== "running") return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [farm.status]);

  const elapsed = elapsedMs(farm, now);
  const totals = snapshot(farm, elapsed);
  const counting = farm.status === "running" || farm.status === "paused";
  const hours = elapsed / 3_600_000;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-3">
            <section className="rounded-card border border-edge bg-moss p-4">
              <label className="text-xs font-medium tracking-widest text-mist uppercase" htmlFor="farm-zone">
                Zone / donjon
              </label>
              <input
                id="farm-zone"
                value={farm.zone}
                onChange={(event) => patchFarm({ zone: event.target.value })}
                placeholder="Klime"
                maxLength={48}
                className="mt-2 min-h-11 w-full rounded-xl border border-edge bg-pine px-3 placeholder:text-mist"
              />
              <label className="mt-4 block text-xs font-medium tracking-widest text-mist uppercase" htmlFor="farm-notes">
                Notes
              </label>
              <textarea
                id="farm-notes"
                value={farm.notes}
                onChange={(event) => patchFarm({ notes: event.target.value })}
                rows={3}
                maxLength={180}
                placeholder="Équipe, défi, anomalie"
                className="mt-2 w-full rounded-xl border border-edge bg-pine px-3 py-2 placeholder:text-mist"
              />
              <p className="mt-3 text-sm text-mist">
                Date et heure :{" "}
                {farm.startedAt
                  ? new Date(farm.startedAt).toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </p>
            </section>

            <section className="rounded-card border border-edge bg-moss p-4">
              <p className="text-xs font-medium tracking-widest text-mist uppercase">Session</p>
              <p className="mt-2 text-center font-medium text-lamp">{STATUS_LABEL[farm.status]}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={startFarm}
                  disabled={farm.status === "running"}
                  className="min-h-11 rounded-full bg-lamp text-sm font-medium text-lamp-ink disabled:opacity-40"
                >
                  {farm.status === "paused" ? "Reprendre" : "Démarrer"}
                </button>
                <button
                  type="button"
                  onClick={pauseFarm}
                  disabled={farm.status !== "running"}
                  className="min-h-11 rounded-full border border-edge text-sm disabled:opacity-40"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={finishFarm}
                  disabled={!counting}
                  className="min-h-11 rounded-full border border-edge text-sm disabled:opacity-40"
                >
                  Terminer
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={addCombat}
                  disabled={!counting}
                  className="min-h-11 rounded-xl border border-edge text-sm disabled:opacity-40"
                >
                  +1 combat
                </button>
                <button
                  type="button"
                  onClick={addDonjon}
                  disabled={!counting}
                  className="min-h-11 rounded-xl border border-edge text-sm disabled:opacity-40"
                >
                  +1 donjon
                </button>
              </div>
            </section>

            <section className="rounded-card border border-edge bg-moss p-4">
              <p className="text-xs font-medium tracking-widest text-mist uppercase">Mesures en temps réel</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Measure label="Durée" value={formatDuration(elapsed)} />
                <Measure label="Combats" value={String(farm.combats)} />
                <Measure label="Donjons" value={String(farm.donjons)} />
                <Measure label="Combats/h" value={formatDecimal(perHour(farm.combats, elapsed))} />
                <Measure label="Donjons/h" value={formatDecimal(perHour(farm.donjons, elapsed))} />
                <Measure label="Moy. combat" value={formatDuration(averageMs(elapsed, farm.combats))} />
              </div>
              <div className="mt-2">
                <Measure label="Moy. donjon" value={formatDuration(averageMs(elapsed, farm.donjons))} />
              </div>
            </section>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
            <section className="rounded-card border border-edge bg-moss p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium tracking-widest text-mist uppercase">Ressources</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addResource}
                    className="flex min-h-11 items-center gap-1 rounded-full bg-lamp px-3 text-sm font-medium text-lamp-ink"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Ajouter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selected) return;
                      removeResource(selected);
                      setSelected(null);
                    }}
                    disabled={!selected}
                    className="min-h-11 rounded-full border border-edge px-3 text-sm disabled:opacity-40"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
              {farm.resources.length === 0 ? (
                <p className="text-sm text-mist">Aucun drop. Cherche un objet du catalogue Dofus 3.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  <li className="hidden grid-cols-[1.4fr_0.6fr_0.8fr_0.8fr] gap-2 px-2 text-xs text-mist sm:grid">
                    <span>Nom</span>
                    <span>Qté</span>
                    <span>Prix unitaire</span>
                    <span>Valeur</span>
                  </li>
                  {farm.resources.map((resource) => {
                    const line = parseKamas(resource.qty) * parseKamas(resource.price);
                    const active = selected === resource.id;
                    return (
                      <li key={resource.id}>
                        <div
                          className={
                            "grid gap-2 rounded-xl border p-2 sm:grid-cols-[1.4fr_0.6fr_0.8fr_0.8fr] " +
                            (active ? "border-lamp bg-canopy" : "border-edge bg-pine")
                          }
                        >
                          <ResourceName
                            resource={resource}
                            onFocus={() => setSelected(resource.id)}
                            onPatch={(patch) => patchResource(resource.id, patch)}
                          />
                          <input
                            aria-label="Quantité"
                            inputMode="numeric"
                            value={resource.qty}
                            onFocus={() => setSelected(resource.id)}
                            onChange={(event) => patchResource(resource.id, { qty: event.target.value })}
                            placeholder="Qté"
                            className="min-h-11 rounded-lg bg-transparent px-2"
                          />
                          <input
                            aria-label="Prix unitaire"
                            inputMode="numeric"
                            value={resource.price}
                            onFocus={() => setSelected(resource.id)}
                            onChange={(event) => patchResource(resource.id, { price: event.target.value })}
                            placeholder="Prix"
                            className="min-h-11 rounded-lg bg-transparent px-2"
                          />
                          <p className="flex min-h-11 items-center px-2 text-sm">{formatKamas(line)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-card border border-edge bg-moss p-4">
              <h3 className="text-xs font-medium tracking-widest text-mist uppercase">Rentabilité</h3>
              <p className="mt-2 text-lg font-medium">Valeur brute : {formatKamas(totals.gross)}</p>
              <CostField
                id="farm-keys"
                label="Coût des clefs"
                value={farm.keys}
                onChange={(value) => patchFarm({ keys: value })}
              />
              <CostField
                id="farm-other"
                label="Autres dépenses"
                value={farm.other}
                onChange={(value) => patchFarm({ other: value })}
              />
              <CostField
                id="farm-jackpot"
                label="Drop exceptionnel / jackpot"
                value={farm.jackpot}
                onChange={(value) => patchFarm({ jackpot: value })}
              />
              <ProfitCard
                title="Rentabilité normale · hors jackpot"
                value={totals.normal}
                elapsed={elapsed}
                hours={hours}
                combats={farm.combats}
                donjons={farm.donjons}
              />
              <ProfitCard
                title="Rentabilité totale · avec jackpot"
                value={totals.total}
                elapsed={elapsed}
                hours={hours}
                combats={farm.combats}
                donjons={farm.donjons}
                emphasis
              />
            </section>
          </div>
          <p className="text-sm text-mist">
            Compteur manuel. Les objets viennent du catalogue Dofus 3 (DofusDB). Le prix unitaire, c'est le tien.
          </p>
          <section>
            <h3 className="mb-2 text-xs font-medium tracking-widest text-mist uppercase">Historique</h3>
            <HistoryList entries={history} onRemove={removeFarmHistory} />
          </section>
    </div>
  );
}

function ResourceName({
  resource,
  onFocus,
  onPatch,
}: {
  resource: FarmResource;
  onFocus: () => void;
  onPatch: (patch: Partial<Pick<FarmResource, "name" | "qty" | "price" | "itemId" | "icon" | "typeName" | "level">>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [hits, setHits] = useState<CatalogItem[]>([]);
  const [broken, setBroken] = useState(false);
  const listId = `items-${resource.id}`;

  useEffect(() => {
    if (!editing) return;
    const query = resource.name.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchItems(query, controller.signal)
        .then((items) => setHits(items))
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setHits([]);
        });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [editing, resource.name]);

  const linked = resource.itemId != null && resource.name.length > 0;

  return (
    <div>
      <div className="flex min-h-11 items-center gap-2">
        {resource.icon && !broken ? (
          <img
            src={resource.icon}
            alt=""
            width={28}
            height={28}
            className="size-7 shrink-0 rounded bg-moss object-contain"
            onError={() => setBroken(true)}
          />
        ) : null}
        <input
          role="combobox"
          aria-label="Nom de la ressource"
          aria-expanded={editing && hits.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={resource.name}
          onFocus={() => {
            onFocus();
            setEditing(true);
          }}
          onChange={(event) => {
            setBroken(false);
            setEditing(true);
            onPatch({ name: event.target.value });
          }}
          placeholder="Étoffe, clef, équipement"
          className="min-h-11 min-w-0 flex-1 rounded-lg bg-transparent px-2"
        />
      </div>
      {linked ? (
        <p className="px-2 text-xs text-mist">
          {[resource.typeName, resource.level != null ? `niv. ${resource.level}` : ""].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {editing && hits.length > 0 ? (
        <ul id={listId} role="listbox" className="mt-1 overflow-hidden rounded-xl border border-edge bg-moss">
          {hits.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                className="flex min-h-11 w-full items-center gap-2 px-2 text-left text-sm hover:bg-canopy"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setBroken(false);
                  setEditing(false);
                  setHits([]);
                  onPatch({
                    name: item.name,
                    itemId: item.id,
                    icon: item.icon,
                    typeName: item.typeName,
                    level: item.level,
                    price: !resource.price && item.price > 1 ? String(item.price) : undefined,
                  });
                }}
              >
                {item.icon ? (
                  <img src={item.icon} alt="" width={28} height={28} className="size-7 shrink-0 object-contain" />
                ) : (
                  <span className="size-7 shrink-0" />
                )}
                <span className="min-w-0">
                  <span className="block truncate">{item.name}</span>
                  <span className="text-xs text-mist">
                    {[item.typeName, `niv. ${item.level}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Measure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-pine px-2 py-2 text-center">
      <p className="text-xs text-mist">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

function CostField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-3 flex items-center justify-between gap-3 text-sm" htmlFor={id}>
      <span className="text-mist">{label}</span>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-36 rounded-xl border border-edge bg-pine px-3 text-right"
      />
    </label>
  );
}

function ProfitCard({
  title,
  value,
  elapsed,
  hours,
  combats,
  donjons,
  emphasis = false,
}: {
  title: string;
  value: number;
  elapsed: number;
  hours: number;
  combats: number;
  donjons: number;
  emphasis?: boolean;
}) {
  const tone = value < 0 ? "text-clay" : "text-lamp";
  const per = (count: number) => (count > 0 ? formatKamas(value / count) : formatKamas(0));
  return (
    <div className={"mt-3 rounded-xl border p-3 " + (emphasis ? "border-lamp/60 bg-pine" : "border-edge bg-pine")}>
      <p className="text-xs tracking-wide text-mist uppercase">{title}</p>
      <p className={"mt-1 text-xl font-medium " + tone}>{formatKamas(value)}</p>
      <p className="mt-1 text-xs text-mist">
        {elapsed >= 1000 ? formatKamas(value / hours) : formatKamas(0)}/h · {per(combats)}/combat · {per(donjons)}/donjon
      </p>
    </div>
  );
}

function HistoryList({
  entries,
  onRemove,
}: {
  entries: FarmHistoryEntry[];
  onRemove: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-card border border-edge bg-moss p-4 text-sm text-mist">
        Aucune session terminée. Le bouton Terminer range le farm ici.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-card border border-edge bg-moss p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{entry.zone}</p>
              <p className="text-sm text-mist">
                {new Date(entry.endedAt).toLocaleString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {" · "}
                {formatDuration(entry.elapsedMs)}
              </p>
              <p className="text-sm text-mist">
                {entry.combats} combats · {entry.donjons} donjons
              </p>
              <p className={"mt-1 font-medium " + (entry.total < 0 ? "text-clay" : "text-lamp")}>
                {formatKamas(entry.total)}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Retirer ${entry.zone}`}
              onClick={() => onRemove(entry.id)}
              className="flex size-11 items-center justify-center text-mist"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
