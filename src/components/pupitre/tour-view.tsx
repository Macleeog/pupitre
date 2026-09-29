import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from "lucide-react";
import { CLASSES, classById, type ClassId } from "@/lib/pupitre/classes";
import { usePupitre } from "@/lib/pupitre/store";
import { ClassArt, Sigil } from "@/components/pupitre/sigil";

export function TourView() {
  const characters = usePupitre((state) => state.characters);
  const focusId = usePupitre((state) => state.focusId);
  const focus = characters.find((character) => character.id === focusId) ?? null;
  const advance = usePupitre((state) => state.advance);
  const setFocus = usePupitre((state) => state.setFocus);
  const moveCharacter = usePupitre((state) => state.moveCharacter);
  const removeCharacter = usePupitre((state) => state.removeCharacter);
  const clearTeam = usePupitre((state) => state.clearTeam);
  const restoreExample = usePupitre((state) => state.restoreExample);

  return (
    <div className="flex flex-col gap-4">
      <article className="overflow-hidden rounded-card bg-paper px-5 py-6 text-ink">
        {focus ? (
          <ClassArt id={focus.classId} className="-mx-5 -mt-6 mb-4 h-32 w-[calc(100%+2.5rem)] max-w-none object-right sm:h-40" />
        ) : null}
        <p className="text-xs font-medium tracking-widest text-ink/60 uppercase">Au premier plan</p>
        {focus ? (
          <>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-full bg-ink/10">
                <Sigil id={focus.classId} className="size-11" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-4xl leading-none sm:text-5xl">{focus.name}</h2>
                <p className="mt-1 text-sm text-ink/70">
                  {classById(focus.classId).name}
                  <span className="text-ink/40"> · {classById(focus.classId).hint}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={advance}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-base font-medium text-paper"
            >
              Tour suivant
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
            <p className="mt-3 text-xs text-ink/55">N passe au suivant. Les touches 1 à 9 choisissent dans l'ordre.</p>
          </>
        ) : (
          <>
            <h2 className="font-display mt-3 text-4xl leading-none">Personne au pupitre</h2>
            <p className="mt-2 text-sm text-ink/70">Ajoute la team, dans l'ordre où tu veux les passer.</p>
            <button
              type="button"
              onClick={restoreExample}
              className="mt-4 min-h-11 rounded-full bg-ink px-4 text-sm font-medium text-paper"
            >
              Charger l'exemple
            </button>
          </>
        )}
      </article>

      <section className="rounded-card border border-edge bg-moss p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-medium">Ordre de passage</h3>
          {characters.length > 0 ? (
            <button type="button" className="min-h-11 text-sm text-mist" onClick={clearTeam}>
              Vider
            </button>
          ) : null}
        </div>
        <ol className="flex flex-col gap-2">
          {characters.map((character, index) => {
            const active = character.id === focusId;
            return (
              <li
                key={character.id}
                className={
                  "flex items-center gap-2 rounded-2xl border px-2 py-1 " +
                  (active ? "border-lamp bg-canopy" : "border-edge bg-pine")
                }
              >
                <button
                  type="button"
                  onClick={() => setFocus(character.id)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="w-5 text-center text-sm text-mist">{index + 1}</span>
                  <Sigil id={character.classId} className="size-8 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{character.name}</span>
                    <span className="block text-xs text-mist">{classById(character.classId).name}</span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Monter ${character.name}`}
                  className="flex size-11 items-center justify-center text-mist"
                  onClick={() => moveCharacter(character.id, -1)}
                  disabled={index === 0}
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Descendre ${character.name}`}
                  className="flex size-11 items-center justify-center text-mist"
                  onClick={() => moveCharacter(character.id, 1)}
                  disabled={index === characters.length - 1}
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Retirer ${character.name}`}
                  className="flex size-11 items-center justify-center text-mist"
                  onClick={() => removeCharacter(character.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ol>
        <AddCharacter />
      </section>
    </div>
  );
}

function AddCharacter() {
  const addCharacter = usePupitre((state) => state.addCharacter);
  const [name, setName] = useState("");
  const [classId, setClassId] = useState<ClassId>("iop");

  return (
    <form
      className="mt-4 flex flex-col gap-3 border-t border-edge pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        addCharacter(name, classId);
        setName("");
      }}
    >
      <label className="text-sm text-mist" htmlFor="character-name">
        Nouveau personnage
      </label>
      <input
        id="character-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nom"
        maxLength={18}
        className="min-h-11 rounded-xl border border-edge bg-pine px-3 text-fog placeholder:text-mist"
      />
      <div className="relative h-28 overflow-hidden rounded-2xl border border-edge bg-pine sm:h-36">
        <ClassArt id={classId} className="absolute inset-0 size-full object-right" />
        <div className="absolute inset-0 bg-gradient-to-r from-pine via-pine/70 to-transparent" />
        <div className="relative flex h-full items-center gap-3 px-4">
          <Sigil id={classId} className="size-12 drop-shadow" />
          <div>
            <p className="font-display text-2xl leading-none">{classById(classId).name}</p>
            <p className="mt-1 text-sm text-mist">{classById(classId).hint}</p>
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
      <button
        type="submit"
        className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-lamp font-medium text-lamp-ink"
      >
        <Plus className="size-4" aria-hidden="true" />
        Ajouter
      </button>
    </form>
  );
}
