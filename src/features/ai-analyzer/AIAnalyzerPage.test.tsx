import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AIAnalyzerPage } from "./AIAnalyzerPage";

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
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
    business: { id: "biz-a", source_version: 2 },
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
    run,
  }),
}));

afterEach(() => {
  cleanup();
  run.mockClear();
});

it("requires explicit consent for AI and allows rules-only analysis", () => {
  render(<AIAnalyzerPage />);
  const aiButton = screen.getByRole("button", { name: "Analyze with AI" });
  expect((aiButton as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Use rules only" }));
  expect(run).toHaveBeenCalledWith(false);
  expect(run).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("checkbox"));
  expect((aiButton as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(aiButton);
  expect(run).toHaveBeenCalledWith(true);
});

it("shows each finding once with its action and expandable evidence", () => {
  render(<AIAnalyzerPage />);
  const plan = screen.getByRole("region", { name: "What to do next" });
  expect(within(plan).getAllByText("Review outstanding receivables")).toHaveLength(1);
  expect(
    within(plan).getByText(
      "Check unpaid sales and customer receipts in your workbook, confirm expected payment dates with customers, then import updated receipts after collection.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText("Check customer receipts and confirm payment dates.")).toBeNull();
  expect(within(plan).getByRole("link", { name: "Open Data Source" }).getAttribute("href")).toBe(
    "/data-source",
  );
  fireEvent.click(within(plan).getByText("Why this recommendation?"));
  expect(screen.getByText("Receivables: 2,940,000 MMK")).toBeTruthy();
});
