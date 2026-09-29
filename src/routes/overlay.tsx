import { createFileRoute } from "@tanstack/react-router";
import { Overlay } from "@/components/pupitre/overlay";

export const Route = createFileRoute("/overlay")({ component: Overlay });
