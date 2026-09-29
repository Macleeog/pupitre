import type { ReactNode } from "react";
import type { ClassId } from "@/lib/pupitre/classes";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const MARKS: Record<ClassId, ReactNode> = {
  feca: <path {...stroke} d="M12 3.5 19.5 7v5.5c0 4.2-3 6.8-7.5 8-4.5-1.2-7.5-3.8-7.5-8V7z" />,
  osamodas: (
    <>
      <circle {...stroke} cx="12" cy="12" r="3" />
      <path {...stroke} d="M12 3.5a8.5 8.5 0 0 1 7.2 4M4.8 16.5A8.5 8.5 0 0 1 12 20.5" />
    </>
  ),
  enutrof: <path {...stroke} d="M8 9h8l1 10H7zM9 9V7.5h6V9" />,
  sram: <path {...stroke} d="M6 18 18 6M9 6h6M15 18H9" />,
  xelor: (
    <>
      <circle {...stroke} cx="12" cy="12" r="7.5" />
      <path {...stroke} d="M12 8v4.2l2.8 1.8" />
    </>
  ),
  ecaflip: (
    <>
      <circle {...stroke} cx="12" cy="12" r="7" />
      <path {...stroke} d="M12 8.5v7M9.2 12h5.6" />
    </>
  ),
  eniripsa: <path {...stroke} d="M12 5v14M5 12h14" />,
  iop: <path {...stroke} d="M12 3.5v12M8.5 19.5h7M9 8.5h6" />,
  cra: <path {...stroke} d="M6 17c4-9 8-11 13-12M7 14c3.5-1 6.5-.5 9 1.5" />,
  sadida: <path {...stroke} d="M12 20V11M12 13c-3-1-5-4-4-7 3 1 4 3 4 5 0-2 1-4 4-5-1 3-1 6-4 7" />,
  sacrieur: <path {...stroke} d="M12 19s-6-3.6-6-8a3.4 3.4 0 0 1 6-2 3.4 3.4 0 0 1 6 2c0 4.4-6 8-6 8z" />,
  pandawa: (
    <>
      <path {...stroke} d="M8 8h8v10H8z" />
      <path {...stroke} d="M8 12h8M10 8V6.5h4V8" />
    </>
  ),
  roublard: (
    <>
      <circle {...stroke} cx="12" cy="13" r="5.5" />
      <path {...stroke} d="M14.5 8.5 17 5" />
    </>
  ),
  zobal: (
    <>
      <path {...stroke} d="M4.5 8c2 3 3.2 3 4.5 0 1.3 3 2.5 3 4.5 0" />
      <path {...stroke} d="M10.5 16c2 3 3.2 3 4.5 0 1.3 3 2.5 3 4.5 0" />
    </>
  ),
  steamer: (
    <>
      <circle {...stroke} cx="12" cy="12" r="3" />
      <path {...stroke} d="M12 4.5v2.5M12 17v2.5M4.5 12H7M17 12h2.5M6.8 6.8l1.8 1.8M15.4 15.4l1.8 1.8M17.2 6.8l-1.8 1.8M8.6 15.4 6.8 17.2" />
    </>
  ),
  eliotrope: (
    <>
      <circle {...stroke} cx="12" cy="12" r="3" />
      <circle {...stroke} cx="12" cy="12" r="7.2" />
    </>
  ),
  huppermage: (
    <>
      <path {...stroke} d="M7 7h4v4H7zM13 7h4v4h-4zM7 13h4v4H7zM13 13h4v4h-4z" />
    </>
  ),
  ouginak: <path {...stroke} d="M7 18 12 5l5 13M9.2 13.5h5.6" />,
  forgelance: <path {...stroke} d="M5 19 17.5 6.5M15 6.5h3.2V9.8M7.5 16.5l-2 2" />,
};

export function Sigil({ id, className }: { id: ClassId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {MARKS[id]}
    </svg>
  );
}
