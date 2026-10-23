import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkingCapitalPage } from "@/features/working-capital/pages/WorkingCapitalPage";
import { CreditPage } from "@/features/credit/pages/CreditPage";

const mocks = vi.hoisted(() => ({
  business: { id: "shop-a", name: "Shop A", source_version: 1 },
  creditData: { business_id: "shop-a", loans: [], recorded_balances: [], readiness: [] } as {
    business_id: string;
    loans: { loan_id: string; lender: string; actual_payments: [] }[];
    recorded_balances: [];
    readiness: [];
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/app/providers", () => ({ usePlatform: () => ({ business: mocks.business }) }));
vi.mock("@/lib/apiClient", () => ({ api: async () => ({ applications: [] }) }));
vi.mock("@/features/working-capital/hooks/useWorkingCapital", () => ({
  useWorkingCapital: () => ({
    snapshot: null,
    error: null,
    loading: false,
    simulate: vi.fn(),
    planReserve: vi.fn(),
  }),
}));
vi.mock("@/features/working-capital/manualInputs", () => ({
  useWorkingCapitalManualInputs: () => ({ inputs: null }),
}));
vi.mock("@/features/working-capital/components/WorkingCapitalInputChoices", () => ({
  WorkingCapitalInputChoices: () => null,
}));
vi.mock("@/features/working-capital/components/InventoryRiskTable", () => ({
  InventoryRiskTable: () => null,
}));
vi.mock("@/features/working-capital/components/WorkingCapitalToolTabs", () => ({
  WorkingCapitalToolTabs: () => <div>Planning tools are available</div>,
}));
vi.mock("@/features/credit/hooks/useCredit", () => ({
  useCredit: () => ({ data: mocks.creditData, isPending: false, isError: false }),
}));
vi.mock("@/features/credit/components/CreditPrintReport", () => ({
  CreditPrintReport: () => null,
}));
vi.mock("@/features/credit/components/RecordLoanForm", () => ({ LoanRecording: () => null }));
vi.mock("@/features/credit/components/UpcomingPaymentTimeline", () => ({
  UpcomingPaymentTimeline: () => null,
}));
vi.mock("@/features/credit/components/LoanSummary", () => ({ LoanSummary: () => null }));
vi.mock("@/features/credit/components/RepaymentSchedule", () => ({
  RepaymentSchedule: () => null,
}));

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.creditData = { business_id: "shop-a", loans: [], recorded_balances: [], readiness: [] };
});
afterEach(() => {
  cleanup();
  client.clear();
});

function mount(page: ReactNode) {
  return render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);
}

it("offers Credit Hub from Working Capital without completing a planning tool", () => {
  mount(<WorkingCapitalPage />);
  const next = screen.getByRole("region", { name: "Plan your next financial move" });
  expect(within(next).getByRole("link", { name: "Open Credit Hub" })).toHaveAttribute(
    "href",
    "/credit",
  );
  expect(screen.getByText("Planning tools are available")).toBeVisible();
});

it("offers AI Analyzer from Credit Hub even when no loans are recorded", () => {
  mount(<CreditPage />);
  expect(screen.getByText("No loans recorded")).toBeVisible();
  const next = screen.getByRole("region", { name: "Get a clearer picture of your business" });
  expect(within(next).getByRole("link", { name: "Open AI Analyzer" })).toHaveAttribute(
    "href",
    "/ai",
  );
  expect(screen.queryByRole("button", { name: "Analyze with AI" })).toBeNull();
});

it("keeps the AI Analyzer link available when the business has a recorded loan", () => {
  mocks.creditData = {
    business_id: "shop-a",
    loans: [{ loan_id: "loan-1", lender: "Test Lender", actual_payments: [] }],
    recorded_balances: [],
    readiness: [],
  };
  mount(<CreditPage />);
  const next = screen.getByRole("region", { name: "Get a clearer picture of your business" });
  expect(within(next).getByRole("link", { name: "Open AI Analyzer" })).toHaveAttribute(
    "href",
    "/ai",
  );
});
