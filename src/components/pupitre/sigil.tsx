import type { ClassId } from "@/lib/pupitre/classes";

export function Sigil({ id, className }: { id: ClassId; className?: string }) {
  return (
    <img
      src={`/classes/${id}.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={"object-contain " + (className ?? "")}
    />
  );
}

export function ClassArt({ id, className }: { id: ClassId; className?: string }) {
  return (
    <img
      src={`/classes/${id}.jpg`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={"object-cover " + (className ?? "")}
    />
  );
}
