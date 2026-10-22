import { ConnectedFinancialPage } from "@/features/financial/pages/ConnectedFinancialPage";

// The routed application uses authenticated feature pages directly. Legacy prototype
// modules remain outside the production route bundle.
export type ModulePage = "financial";

export function ModuleRoute({ page: _page }: { page: ModulePage }) {
  return <ConnectedFinancialPage />;
}
