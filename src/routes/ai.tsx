import { createFileRoute } from "@tanstack/react-router";
import { ModuleRoute } from "@/app/routes";
export const Route = createFileRoute("/ai")({ component: () => <ModuleRoute page="ai" /> });
