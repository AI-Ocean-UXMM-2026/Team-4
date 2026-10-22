import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialPage } from "../pages/FinancialPage";
import { FinancialKpiCards } from "../components/FinancialKpiCards";
import { useFinancialSummary } from "../hooks/useFinancialSummary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FinancialClient, FinancialSnapshot } from "../types";

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
      points: [],
      as_of: "2026-10-20T10:00:00Z",
      import_batch_id: batch,
    }),
  };
}

function Probe({ api, batch }: { api: FinancialClient; batch: string }) {
  const state = useFinancialSummary(api, "A", { start: "2026-10-01", end: "2026-10-20" }, batch, 0);
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
      points: [],
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
    expect(screen.getByText("Please note about this report")).toBeTruthy();
    expect(screen.getByText(/2026-10-01 – 2026-10-20 · Yangon time/)).toBeTruthy();
    expect(screen.getByText("2026-10-15 · Overdue")).toBeTruthy();
    expect(screen.getByText("30,000 MMK")).toBeTruthy();
    expect(screen.getByText("No reporting periods available.")).toBeTruthy();
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
    api.trends = vi.fn(async (businessId) => ({
      business_id: businessId,
      points: [],
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
  });

  it("keeps the selected period when requesting a newly selected business", async () => {
    const api = client();
    api.summary = vi.fn(async (businessId, period) => ({
      ...snapshot(),
      business_id: businessId,
      period,
    }));
    api.trends = vi.fn(async (businessId) => ({
      business_id: businessId,
      points: [],
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
    await screen.findByText("150,000 MMK");
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
  });
});
