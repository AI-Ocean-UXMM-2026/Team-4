import { createFileRoute } from "@tanstack/react-router";
import { ModuleRoute } from "@/app/routes";
export const Route = createFileRoute("/working-capital")({
  component: () => <ModuleRoute page="working-capital" />,
});
