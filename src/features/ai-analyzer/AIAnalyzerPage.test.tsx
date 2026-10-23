import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AIAnalyzerPage } from "./AIAnalyzerPage";

const { run, mockWarnings } = vi.hoisted(() => ({
  run: vi.fn(),
  mockWarnings: [] as string[],
}));
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
      import_batch_id: "batch-a",
      warnings: mockWarnings,
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
  mockWarnings.length = 0;
});

it("shows a compact summary without a rules-based badge and keeps provider details available", () => {
  mockWarnings.push("AI provider is not configured; rules-based findings are shown.");
  render(<AIAnalyzerPage />);

  const summary = screen.getByRole("region", { name: "Analysis Summary" });
  expect(within(summary).getByText("Analysis Summary")).toBeVisible();
  expect(within(summary).queryByText("Verified rules-based analysis")).toBeNull();
  expect(within(summary).queryByText(/AI provider is not configured/)).toBeNull();
  expect(within(summary).getByText("Generated:")).toBeVisible();
  expect(within(summary).getByText("Import version:")).toBeVisible();

  fireEvent.click(within(summary).getByRole("button", { name: "View analysis details" }));
  expect(within(summary).getByText("Source as of:")).toBeVisible();
  expect(within(summary).getByText("Batch ID:")).toBeVisible();
  expect(within(summary).queryByText("Provider configuration status:")).toBeNull();
});

it("consolidates incomplete-data warnings without hiding the limitation", () => {
  mockWarnings.push(
    "Financial snapshot is partial or missing.",
    "Financial source contains data-quality warnings.",
  );
  render(<AIAnalyzerPage />);

  const summary = screen.getByRole("region", { name: "Analysis Summary" });
  expect(within(summary).getByText(
    "Some financial data is incomplete. Recommendations are based on available verified records.",
  )).toBeVisible();
  expect(within(summary).queryByText("Financial snapshot is partial or missing.")).toBeNull();
  expect(within(summary).queryByText("Financial source contains data-quality warnings.")).toBeNull();
});

it("offers one clearly disclosed AI action", () => {
  render(<AIAnalyzerPage />);
  const aiButton = screen.getByRole("button", { name: "Analyze with AI" });
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "Use rules only" })).toBeNull();
  expect(screen.queryByText(/By selecting Analyze with AI, you agree/)).toBeNull();
  expect(screen.getByText("Analyze your imported business data with AI, then explore the details in Financial Health, Working Capital, and Credit Hub.")).toBeVisible();
  fireEvent.click(aiButton);
  expect(run).toHaveBeenCalledWith(true);
  expect(run).toHaveBeenCalledTimes(1);
});

it("shows each finding once with its action and expandable evidence", () => {
  render(<AIAnalyzerPage />);
  const plan = screen.getByRole("region", { name: "What to do next" });
  expect(within(plan).getAllByText("Review outstanding receivables")).toHaveLength(1);
  expect(
    within(plan).getByText(
      "The financial snapshot records uncollected customer balances that represent trapped working capital.",
    ),
  ).toBeTruthy();
  expect(
    within(plan).getByText(
      "Open Financial Health to inspect customer balance details and identify aging accounts.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText("Check customer receipts and confirm payment dates.")).toBeNull();
  expect(within(plan).getByRole("link", { name: /Open Financial Health/i }).getAttribute("href")).toBe(
    "/",
  );
  fireEvent.click(within(plan).getByText(/View Details & Evidence/));
  expect(screen.getByText(/Receivables/)).toBeTruthy();
  expect(screen.getByText("2,940,000 MMK")).toBeTruthy();
});
