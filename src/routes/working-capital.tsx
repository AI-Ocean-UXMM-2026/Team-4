import { createFileRoute } from "@tanstack/react-router";
import { WorkingCapitalPage } from "@/features/working-capital/pages/WorkingCapitalPage";
export const Route = createFileRoute("/working-capital")({
  component: WorkingCapitalPage,
});
