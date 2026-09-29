import { useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { usePupitre } from "@/lib/pupitre/store";

export function TextsView() {
  const texts = usePupitre((state) => state.texts);
  const addText = usePupitre((state) => state.addText);
  const removeText = usePupitre((state) => state.removeText);
  const [label, setLabel] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");

  const copy = async (id: string, value: string) => {
    setError("");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1400);
    } catch {
      setError("La copie a échoué. Sélectionne le texte à la main.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-card bg-paper px-5 py-5 text-ink">
        <h2 className="font-display text-3xl leading-none">Textes rapides</h2>
        <p className="mt-2 text-sm text-ink/70">
          Une touche copie la phrase. Tu la colles dans le chat du client, comme le raccourci Multifus.
        </p>
      </section>
      {error ? <p className="text-sm text-clay">{error}</p> : null}
      <ul className="flex flex-col gap-2">
        {texts.map((text) => (
          <li key={text.id} className="rounded-card border border-edge bg-moss p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-widest text-lamp uppercase">{text.label}</p>
                <p className="mt-1 text-base">{text.body}</p>
              </div>
              <button
                type="button"
                aria-label={`Retirer ${text.label}`}
                className="flex size-11 items-center justify-center text-mist"
                onClick={() => removeText(text.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => void copy(text.id, text.body)}
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-lamp font-medium text-lamp-ink"
            >
              {copied === text.id ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied === text.id ? "Copié" : "Copier"}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-2 rounded-card border border-edge bg-moss p-4"
        onSubmit={(event) => {
          event.preventDefault();
          addText(label, body);
          setLabel("");
          setBody("");
        }}
      >
        <h3 className="font-medium">Nouvelle phrase</h3>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Raccourci"
          maxLength={24}
          aria-label="Nom du texte"
          className="min-h-11 rounded-xl border border-edge bg-pine px-3 placeholder:text-mist"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="La phrase à coller"
          maxLength={180}
          rows={3}
          aria-label="Phrase"
          className="rounded-xl border border-edge bg-pine px-3 py-2 placeholder:text-mist"
        />
        <button type="submit" className="min-h-11 rounded-full bg-canopy font-medium">
          Enregistrer
        </button>
      </form>
    </div>
  );
}
