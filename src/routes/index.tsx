import { createFileRoute } from "@tanstack/react-router";
import { Desk } from "@/components/pupitre/desk";

export const Route = createFileRoute("/")({ component: Desk });
