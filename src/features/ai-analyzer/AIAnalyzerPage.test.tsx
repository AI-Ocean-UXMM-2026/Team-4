import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AIAnalyzerPage } from "./AIAnalyzerPage";

vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ t: (text: string) => text }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("./useBusinessAnalysis", () => ({
  useBusinessAnalysis: () => ({
    business: { source_version: 2 },
    report: {
      status: "rules_only",
      source_version: 2,
      generated_at: "2026-10-22T00:00:00Z",
      data_as_of: "2026-10-21T00:00:00Z",
      warnings: [],
      disclaimer: "Decision support only.",
      insights: [
        {
          id: "receivables-followup",
          category: "liquidity",
          priority: "medium",
          title: "Review outstanding receivables",
          explanation: "The financial snapshot records unpaid customer balances.",
          evidence: [{ metric: "receivables_mmk", value: "2940000.00000" }],
          suggested_actions: ["Check customer receipts and confirm payment dates."],
          assumptions: ["The workbook does not establish whether these balances are overdue."],
        },
      ],
    },
    isOutdated: false,
    isLoading: false,
    error: null,
    isAnalyzing: false,
    run: vi.fn(),
  }),
}));

afterEach(cleanup);

it("puts a specific next action and destination ahead of report detail", () => {
  render(<AIAnalyzerPage />);
  const plan = screen.getByRole("region", { name: "What to do next" });
  expect(within(plan).getByText("Check customer receipts and confirm payment dates.")).toBeTruthy();
  expect(within(plan).getByRole("link", { name: "Open Data Source" }).getAttribute("href")).toBe(
    "/data-source",
  );
  expect(screen.getByText("Receivables: 2,940,000 MMK")).toBeTruthy();
});
