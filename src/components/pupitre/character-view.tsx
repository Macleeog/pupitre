import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { CLASSES, classById, type ClassId } from "@/lib/pupitre/classes";
import { usePupitre } from "@/lib/pupitre/store";
import { ClassArt, Sigil } from "@/components/pupitre/sigil";

export function CharacterView() {
  const me = usePupitre((state) => state.me);
  const [editing, setEditing] = useState(false);

  if (!me || editing) {
    return <CharacterForm onDone={() => setEditing(false)} canCancel={Boolean(me)} />;
  }

  const info = classById(me.classId);
  return (
    <article className="overflow-hidden rounded-card bg-paper text-ink">
      <ClassArt id={me.classId} className="h-32 w-full object-right sm:h-40" />
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-ink/10">
          <Sigil id={me.classId} className="size-11" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-widest text-ink/60 uppercase">Mon personnage</p>
          <h2 className="font-display truncate text-3xl leading-none sm:text-4xl">{me.name}</h2>
          <p className="mt-1 text-sm text-ink/70">
            {info.name}
            <span className="text-ink/40"> · {info.hint}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Modifier mon personnage"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full border border-ink/15 text-sm font-medium sm:px-4"
        >
          <Pencil className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Modifier</span>
        </button>
      </div>
    </article>
  );
}

function CharacterForm({ onDone, canCancel }: { onDone: () => void; canCancel: boolean }) {
  const me = usePupitre((state) => state.me);
  const setMe = usePupitre((state) => state.setMe);
  const [name, setName] = useState(me?.name ?? "");
  const [classId, setClassId] = useState<ClassId>(me?.classId ?? "iop");
  const info = classById(classId);

  return (
    <form
      className="flex flex-col gap-3 rounded-card border border-edge bg-moss p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        setMe(name, classId);
        onDone();
      }}
    >
      <label className="text-xs font-medium tracking-widest text-mist uppercase" htmlFor="character-name">
        Mon personnage
      </label>
      <input
        id="character-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nom du personnage"
        maxLength={18}
        className="min-h-11 rounded-xl border border-edge bg-pine px-3 text-fog placeholder:text-mist"
      />
      <div className="relative h-28 overflow-hidden rounded-2xl border border-edge bg-pine sm:h-36">
        <ClassArt id={classId} className="absolute inset-0 size-full object-right" />
        <div className="absolute inset-0 bg-gradient-to-r from-pine via-pine/70 to-transparent" />
        <div className="relative flex h-full items-center gap-3 px-4">
          <Sigil id={classId} className="size-12 drop-shadow" />
          <div>
            <p className="font-display text-2xl leading-none">{info.name}</p>
            <p className="mt-1 text-sm text-mist">{info.hint}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" role="listbox" aria-label="Classe">
        {CLASSES.map((entry) => {
          const selected = entry.id === classId;
          return (
            <button
              key={entry.id}
              type="button"
              role="option"
              aria-selected={selected}
              title={entry.name}
              onClick={() => setClassId(entry.id)}
              className={
                "flex min-h-11 flex-col items-center gap-1 rounded-xl border px-1 py-2 " +
                (selected ? "border-lamp bg-canopy" : "border-edge bg-pine hover:border-mist")
              }
            >
              <Sigil id={entry.id} className="size-9" />
              <span className={"w-full truncate text-center text-[11px] " + (selected ? "text-fog" : "text-mist")}>
                {entry.name}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-lamp font-medium text-lamp-ink disabled:opacity-50"
        >
          <Check className="size-4" aria-hidden="true" />
          Enregistrer
        </button>
        {canCancel ? (
          <button
            type="button"
            onClick={onDone}
            className="min-h-11 rounded-full border border-edge px-4 text-sm font-medium text-fog"
          >
            Annuler
          </button>
        ) : null}
      </div>
    </form>
  );
}
