import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AIAnalyzerPage } from "./AIAnalyzerPage";

const { run, mockState } = vi.hoisted(() => {
  const defaultReport = {
    status: "rules_only" as "rules_only" | "completed" | "insufficient_data" | "unavailable",
    source_version: 2,
    generated_at: "2026-10-22T00:00:00Z",
    data_as_of: "2026-10-21T00:00:00Z" as string | null,
    warnings: [] as string[],
    disclaimer: "Decision support only.",
    insights: [
      {
        id: "receivables-followup",
        category: "liquidity" as const,
        priority: "medium" as const,
        title: "Review outstanding receivables",
        explanation: "The financial snapshot records unpaid customer balances.",
        evidence: [{ metric: "receivables_mmk", value: "2940000.00000" }],
        suggested_actions: ["Check customer receipts and confirm payment dates."],
        assumptions: ["The workbook does not establish whether these balances are overdue."],
      },
    ],
  };
  return {
    run: vi.fn(),
    mockState: { report: { ...defaultReport } },
  };
});

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
    report: mockState.report,
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
  mockState.report = {
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
  };
});

it("offers one clearly disclosed AI action", () => {
  render(<AIAnalyzerPage />);
  const aiButton = screen.getByRole("button", { name: "Analyze with AI" });
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "Use rules only" })).toBeNull();
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
    "/financial",
  );
  fireEvent.click(within(plan).getByText(/View Details & Evidence/));
  expect(screen.getByText(/Receivables/)).toBeTruthy();
  expect(screen.getByText("2,940,000 MMK")).toBeTruthy();
});

it("renders compact Analysis Summary card with verified rules-based analysis badge", () => {
  render(<AIAnalyzerPage />);
  const summary = screen.getByRole("region", { name: "Analysis Summary" });
  expect(within(summary).getByText("Analysis Summary")).toBeTruthy();
  expect(within(summary).getByText("Verified rules-based analysis")).toBeTruthy();
  expect(within(summary).queryByText("AI-assisted analysis")).toBeNull();
  expect(within(summary).getByText("Generated:")).toBeTruthy();
  expect(within(summary).getByText("Import version:")).toBeTruthy();
  expect(within(summary).getByText("2")).toBeTruthy();
  expect(within(summary).getByRole("button", { name: "View analysis details" })).toBeTruthy();
});

it("renders AI-assisted analysis badge when real external AI successfully contributed", () => {
  mockState.report = {
    ...mockState.report,
    status: "completed",
  };
  render(<AIAnalyzerPage />);
  const summary = screen.getByRole("region", { name: "Analysis Summary" });
  expect(within(summary).getByText("AI-assisted analysis")).toBeTruthy();
  expect(within(summary).queryByText("Verified rules-based analysis")).toBeNull();
});

it("combines repetitive warnings into a single concise message when data is incomplete", () => {
  mockState.report = {
    ...mockState.report,
    warnings: [
      "Financial snapshot is partial or missing.",
      "Financial source contains data-quality warnings.",
    ],
  };
  render(<AIAnalyzerPage />);
  const summary = screen.getByRole("region", { name: "Analysis Summary" });
  expect(
    within(summary).getByText(
      "Some financial data is incomplete. Recommendations are based on available verified records.",
    ),
  ).toBeTruthy();
  // Repetitive raw messages are not displayed as separate warning blocks
  expect(within(summary).queryByText("Financial snapshot is partial or missing.")).toBeNull();
  expect(within(summary).queryByText("Financial source contains data-quality warnings.")).toBeNull();
});

it("does not render external AI unconfigured warning note in summary", () => {
  mockState.report = {
    ...mockState.report,
    warnings: ["AI provider is not configured; rules-based findings are shown."],
  };
  render(<AIAnalyzerPage />);
  const summary = screen.getByRole("region", { name: "Analysis Summary" });
  expect(
    within(summary).queryByText(
      "External AI is not configured. Verified rules-based findings are shown.",
    ),
  ).toBeNull();
});

it("toggles secondary metadata in expandable details section", () => {
  mockState.report = {
    ...mockState.report,
    data_as_of: "2026-10-21T12:00:00Z",
  };
  render(<AIAnalyzerPage />);
  const summary = screen.getByRole("region", { name: "Analysis Summary" });
  const toggle = within(summary).getByRole("button", { name: "View analysis details" });
  expect(within(summary).queryByText("Source as of:")).toBeNull();

  fireEvent.click(toggle);
  expect(within(summary).getByRole("button", { name: "Hide analysis details" })).toBeTruthy();
  expect(within(summary).getByText("Source as of:")).toBeTruthy();
  expect(within(summary).getByText("Provider configuration status:")).toBeTruthy();

  fireEvent.click(within(summary).getByRole("button", { name: "Hide analysis details" }));
  expect(within(summary).queryByText("Source as of:")).toBeNull();
});

