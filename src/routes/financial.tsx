import { createFileRoute } from "@tanstack/react-router";
import { ConnectedFinancialPage } from "@/features/financial/pages/ConnectedFinancialPage";

export const Route = createFileRoute("/financial")({
  component: ConnectedFinancialPage,
});
