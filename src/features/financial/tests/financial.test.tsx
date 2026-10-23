import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialPage } from "../pages/FinancialPage";
import { FinancialKpiCards } from "../components/FinancialKpiCards";
import { useFinancialSummary } from "../hooks/useFinancialSummary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FinancialClient, FinancialSnapshot } from "../types";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

function snapshot(batch = "batch-1"): FinancialSnapshot {
  return {
    business_id: "A",
    period: { start: "2026-10-01", end: "2026-10-20" },
    actual: {
      revenue_mmk: 50000,
      cogs_mmk: 40000,
      gross_profit_mmk: 10000,
      operating_expenses_mmk: 0,
      operating_profit_mmk: 10000,
      interest_expenses_mmk: 0,
      profit_before_tax_mmk: 10000,
      cash_balance_mmk: 150000,
      receivables_mmk: 0,
      payables_mmk: 0,
    },
    upcoming_obligations: [],
    data_quality: { status: "complete", missing_sheets: [], warnings: [] },
    as_of: "2026-10-20T10:00:00Z",
    import_batch_id: batch,
  };
}

function client(batch = "batch-1"): FinancialClient {
  return {
    summary: vi.fn().mockResolvedValue(snapshot(batch)),
    trends: vi.fn().mockResolvedValue({
      business_id: "A",
      granularity: "weekly",
      points: [
        {
          period: { start: "2026-10-01", end: "2026-10-20" },
          revenue_mmk: 0,
          cogs_mmk: 0,
          operating_expenses_mmk: 0,
          total_costs_mmk: 0,
          revenue_record_count: 0,
          operating_expense_record_count: 0,
        },
      ],
      as_of: "2026-10-20T10:00:00Z",
      import_batch_id: batch,
    }),
  };
}

function Probe({ api, batch }: { api: FinancialClient; batch: string }) {
  const state = useFinancialSummary(
    api,
    "A",
    { start: "2026-10-01", end: "2026-10-20" },
    "weekly",
    batch,
    0,
  );
  return (
    <div>
      {state.status === "ready"
        ? state.snapshot?.actual.cash_balance_mmk
        : state.status === "error"
          ? state.error
          : "Loading"}
    </div>
  );
}

describe("Financial reporting", () => {
  it("reuses the current import when returning to the page but fetches a new import", async () => {
    const queries = new QueryClient();
    const api = client();
    const first = render(
      <QueryClientProvider client={queries}>
        <Probe api={api} batch="batch-1" />
      </QueryClientProvider>,
    );
    await screen.findByText("150000");
    first.unmount();
    const second = render(
      <QueryClientProvider client={queries}>
        <Probe api={api} batch="batch-1" />
      </QueryClientProvider>,
    );
    expect(screen.getByText("150000")).toBeTruthy();
    expect(api.summary).toHaveBeenCalledTimes(1);
    second.rerender(
      <QueryClientProvider client={queries}>
        <Probe api={api} batch="batch-2" />
      </QueryClientProvider>,
    );
    expect(screen.getByText("Loading")).toBeTruthy();
    await waitFor(() => expect(api.summary).toHaveBeenCalledTimes(2));
    second.unmount();
    queries.clear();
  });
  it("shows imported figures with MMK and treats missing as unavailable", () => {
    const data = snapshot();
    data.actual.revenue_mmk = null;
    render(<FinancialKpiCards snapshot={data} />);
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.getByText("150,000 MMK")).toBeTruthy();
    expect(screen.getByText("Cost of products sold during this period.")).toBeTruthy();
    expect(screen.getByText("Revenue minus cost of goods sold and operating expenses.")).toBeTruthy();
  });

  it("explains missing historical sale costs without presenting an unavailable KPI as zero", () => {
    const data = snapshot();
    data.actual.cogs_mmk = null;
    data.actual.operating_profit_mmk = null;
    render(<FinancialKpiCards snapshot={data} />);
    const cogs = screen.getByText("Cost of goods sold").closest("article");
    expect(cogs?.textContent).toContain("Unavailable");
    expect(cogs?.textContent).toContain(
      "historical sale costs are missing for one or more sales in this period",
    );
    expect(cogs?.textContent).not.toContain("0 MMK");
    expect(screen.getByText("Revenue minus cost of goods sold and operating expenses.")).toBeTruthy();
  });

  it("links to data source without fetching when no workbook is imported", async () => {
    const api = client();
    render(
      <FinancialPage
        client={api}
        businessId="A"
        businessName="Demo Store"
        synthetic
        importBatchId={null}
        today="2026-10-20"
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Start with your business data" }),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(api.summary).not.toHaveBeenCalled();
    expect(api.trends).not.toHaveBeenCalled();
    expect(screen.getByText("Synthetic demo data")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Set up my data" }).getAttribute("href")).toBe(
      "/data-source",
    );
    expect(
      screen.queryByRole("region", { name: "Explore ways to improve your cash flow" }),
    ).toBeNull();
  });

  it("clears previous cards during a new import and ignores late responses", async () => {
    const api = client();
    const view = render(<Probe api={api} batch="batch-1" />);
    expect(await screen.findByText("150000")).toBeTruthy();
    let resolve!: (s: FinancialSnapshot) => void;
    api.summary = vi.fn().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    api.trends = vi.fn().mockResolvedValue({
      business_id: "A",
      granularity: "weekly",
      points: [
        {
          period: { start: "2026-10-01", end: "2026-10-20" },
          revenue_mmk: 0,
          cogs_mmk: 0,
          operating_expenses_mmk: 0,
          total_costs_mmk: 0,
          revenue_record_count: 0,
          operating_expense_record_count: 0,
        },
      ],
      import_batch_id: "batch-2",
      as_of: "2026-10-20T10:00:00Z",
    });
    view.rerender(<Probe api={api} batch="batch-2" />);
    expect(screen.queryByText("150000")).toBeNull();
    expect(screen.getByText("Loading")).toBeTruthy();
    await act(async () => resolve(snapshot("batch-1")));
    expect(await screen.findByText(/stale or inconsistent/)).toBeTruthy();
  });

  it("does not display another business response", async () => {
    const api = client();
    api.summary = vi.fn().mockResolvedValue({ ...snapshot(), business_id: "B" });
    render(<Probe api={api} batch="batch-1" />);
    await waitFor(() => expect(screen.getByText(/stale or inconsistent/)).toBeTruthy());
    expect(screen.queryByText("150000")).toBeNull();
  });

  it("shows API failure and hides previous totals", async () => {
    const api = client();
    api.summary = vi.fn().mockRejectedValue(new Error("Financial API unavailable."));
    render(<Probe api={api} batch="batch-1" />);
    expect(await screen.findByText("Financial API unavailable.")).toBeTruthy();
  });

  it("renders the complete page from imported records including warnings and obligations", async () => {
    const api = client();
    const data = snapshot();
    data.upcoming_obligations = [
      { kind: "supplier", reference_id: "P001", due_date: "2026-10-15", amount_mmk: 30000 },
    ];
    data.data_quality.warnings = ["Interest uses cash-paid amounts."];
    api.summary = vi.fn().mockResolvedValue(data);
    render(
      <FinancialPage
        client={api}
        businessId="A"
        businessName="Demo Store"
        synthetic
        importBatchId="batch-1"
        today="2026-10-20"
      />,
    );
    expect(await screen.findByText("150,000 MMK")).toBeTruthy();
    const nextStep = screen.getByRole("region", { name: "Explore ways to improve your cash flow" });
    expect(within(nextStep).getByRole("link", { name: "Explore Working Capital" })).toHaveAttribute(
      "href",
      "/working-capital",
    );
    expect(within(nextStep).getByRole("link", { name: "Open Credit Hub" })).toHaveAttribute(
      "href",
      "/credit",
    );
    expect(screen.queryByText("Please note about this report")).toBeNull();
    expect(screen.queryByText("Interest uses cash-paid amounts.")).toBeNull();
    expect(screen.getByText(/2026-10-01 – 2026-10-20 · Yangon time/)).toBeTruthy();
    const obligationsTable = screen.getByRole("table", {
      name: /outstanding business obligations/i,
    });
    const supplierRow = within(obligationsTable).getByText("P001").closest("tr");
    expect(supplierRow?.textContent).toContain("2026-10-15");
    expect(supplierRow?.textContent).toContain("Overdue");
    expect(supplierRow?.textContent).toContain("30,000 MMK");
    expect(
      screen.getByRole("table", { name: "Exact trend figures; unavailable values are not zero" }),
    ).toBeTruthy();
    expect(screen.queryByText("No reporting periods available.")).toBeNull();
    const chart = screen.getByRole("region", { name: "Revenue and total cost trends" });
    const obligations = screen.getByRole("region", { name: "Outstanding supplier payments section" });
    expect(within(obligations).queryByText("Outstanding loan principal")).toBeNull();
    const chartPanel = chart.parentElement;
    const obligationsPanel = obligations.parentElement;
    expect(chartPanel?.parentElement).toBe(obligationsPanel?.parentElement);
    expect(chartPanel?.nextElementSibling).toBe(nextStep);
    expect(nextStep.nextElementSibling).toBe(obligationsPanel);
    expect(screen.getAllByRole("region", { name: "Explore ways to improve your cash flow" })).toHaveLength(1);
    expect(chartPanel?.parentElement?.className).toContain("flex-col");
  });

  it.each([
    ["Current month", "2024-02-29", "2024-02-01", "2024-02-29"],
    ["Last 30 days", "2026-10-22", "2026-09-23", "2026-10-22"],
    ["Previous month", "2026-01-15", "2025-12-01", "2025-12-31"],
    ["Last 3 months", "2026-10-22", "2026-07-22", "2026-10-22"],
    ["Last 6 months", "2024-08-31", "2024-02-29", "2024-08-31"],
    ["This year", "2026-10-22", "2026-01-01", "2026-10-22"],
  ])("requests the correct dates for %s", async (label, today, start, end) => {
    const api = client();
    api.summary = vi.fn(async (businessId, period) => ({
      ...snapshot(),
      business_id: businessId,
      period,
    }));
    const granularity = ["Last 3 months", "Last 6 months", "This year"].includes(label)
      ? "monthly"
      : "weekly";
    api.trends = vi.fn(async (businessId, period, requestedGranularity) => ({
      business_id: businessId,
      granularity: requestedGranularity,
      points: [
        {
          period,
          revenue_mmk: 0,
          cogs_mmk: 0,
          operating_expenses_mmk: 0,
          total_costs_mmk: 0,
          revenue_record_count: 0,
          operating_expense_record_count: 0,
        },
      ],
      as_of: "2026-10-20T10:00:00Z",
      import_batch_id: "batch-1",
    }));
    render(
      <FinancialPage
        client={api}
        businessId="A"
        businessName="Demo Store"
        synthetic
        importBatchId="batch-1"
        today={today}
      />,
    );
    if (label !== "Current month") {
      fireEvent.change(screen.getByRole("combobox", { name: "Reporting period" }), {
        target: {
          value:
            label === "Previous month"
              ? "previous"
              : label === "Last 3 months"
                ? "3months"
                : label === "Last 6 months"
                  ? "6months"
                  : label === "This year"
                    ? "year"
                    : "30days",
        },
      });
    }
    await waitFor(() =>
      expect(api.summary).toHaveBeenLastCalledWith("A", { start, end }, expect.any(AbortSignal)),
    );
    await waitFor(() =>
      expect(api.trends).toHaveBeenLastCalledWith(
        "A",
        { start, end },
        granularity,
        expect.any(AbortSignal),
      ),
    );
  });

  it("updates period KPIs while keeping cumulative cash distinct from period revenue", async () => {
    const api = client();
    api.summary = vi.fn(async (businessId, period) => ({
      ...snapshot(),
      business_id: businessId,
      period,
      actual: {
        ...snapshot().actual,
        revenue_mmk: period.start === "2026-09-01" ? 0 : 50000,
        cogs_mmk: period.start === "2026-09-01" ? 0 : 40000,
        operating_profit_mmk: period.start === "2026-09-01" ? 0 : 10000,
        cash_balance_mmk: period.start === "2026-09-01" ? 110000 : 150000,
      },
    }));
    api.trends = vi.fn(async (businessId, period, granularity) => ({
      business_id: businessId,
      granularity,
      points: [{
        period,
        revenue_mmk: 0,
        cogs_mmk: 0,
        operating_expenses_mmk: 0,
        total_costs_mmk: 0,
        revenue_record_count: 0,
        operating_expense_record_count: 0,
      }],
      as_of: "2026-10-20T10:00:00Z",
      import_batch_id: "batch-1",
    }));
    render(<FinancialPage client={api} businessId="A" businessName="Business A" synthetic importBatchId="batch-1" today="2026-10-22" />);
    await waitFor(() =>
      expect(screen.getByText("Cash available").closest("article")).toHaveTextContent("150,000 MMK"),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Reporting period" }), {
      target: { value: "previous" },
    });
    await waitFor(() =>
      expect(screen.getByText("Cash available").closest("article")).toHaveTextContent("110,000 MMK"),
    );
    expect(screen.getByText("Cash available").closest("article")).not.toHaveTextContent("150,000 MMK");
    const figures = within(screen.getByRole("region", { name: "Financial summary" }));
    expect(figures.getByText("Revenue").closest("article")?.textContent).toContain("0 MMK");
    expect(figures.getByText("Cost of goods sold").closest("article")?.textContent).toContain("0 MMK");
  });

  it("keeps the selected period when requesting a newly selected business", async () => {
    const api = client();
    api.summary = vi.fn(async (businessId, period) => ({
      ...snapshot(),
      business_id: businessId,
      period,
      actual: {
        ...snapshot().actual,
        cash_balance_mmk: businessId === "A" ? 150000 : null,
        cogs_mmk: businessId === "A" ? 40000 : null,
        operating_profit_mmk: businessId === "A" ? 10000 : null,
      },
    }));
    api.trends = vi.fn(async (businessId, period, requestedGranularity) => ({
      business_id: businessId,
      granularity: requestedGranularity,
      points: [
        {
          period,
          revenue_mmk: 0,
          cogs_mmk: 0,
          operating_expenses_mmk: 0,
          total_costs_mmk: 0,
          revenue_record_count: 0,
          operating_expense_record_count: 0,
        },
      ],
      as_of: "2026-10-20T10:00:00Z",
      import_batch_id: "batch-1",
    }));
    const view = render(
      <FinancialPage
        client={api}
        businessId="A"
        businessName="Business A"
        synthetic
        importBatchId="batch-1"
        today="2026-10-22"
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("Cash available").closest("article")).toHaveTextContent("150,000 MMK"),
    );
    view.rerender(
      <FinancialPage
        client={api}
        businessId="B"
        businessName="Business B"
        synthetic
        importBatchId="batch-1"
        today="2026-10-22"
      />,
    );
    await waitFor(() =>
      expect(api.summary).toHaveBeenLastCalledWith(
        "B",
        { start: "2026-10-01", end: "2026-10-22" },
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() =>
      expect(api.trends).toHaveBeenLastCalledWith(
        "B",
        { start: "2026-10-01", end: "2026-10-22" },
        "weekly",
        expect.any(AbortSignal),
      ),
    );
    const cashCard = screen.getByText("Cash available").closest("article");
    expect(cashCard?.textContent).toContain("Unavailable");
    expect(screen.getByText("Cash available").closest("article")).not.toHaveTextContent("150,000 MMK");
    const cogsCard = screen.getByText("Cost of goods sold").closest("article");
    expect(cogsCard?.textContent).toContain("historical sale costs are missing");
    view.rerender(
      <FinancialPage
        client={api}
        businessId="A"
        businessName="Business A"
        synthetic
        importBatchId="batch-1"
        today="2026-10-22"
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("Cash available").closest("article")).toHaveTextContent("150,000 MMK"),
    );
    expect(screen.getByText("Cost of goods sold").closest("article")?.textContent).toContain(
      "Cost of products sold during this period.",
    );
  });
});
