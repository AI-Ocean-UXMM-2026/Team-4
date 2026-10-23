import { cleanup, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CashflowTrendChart } from "../components/CashflowTrendChart";
import type { Trends } from "../types";

afterEach(cleanup);

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => vi.unstubAllGlobals());

const trends: Trends = {
  business_id: "business-1",
  as_of: "2026-10-22T03:30:00Z",
  import_batch_id: "batch-1",
  points: [
    {
      period: { start: "2026-08-01", end: "2026-08-31" },
      revenue_mmk: 0,
      cogs_mmk: 0,
      operating_expenses_mmk: 0,
      total_costs_mmk: 0,
      revenue_record_count: 0,
      operating_expense_record_count: 0,
    },
    {
      period: { start: "2026-09-01", end: "2026-09-30" },
      revenue_mmk: 0,
      cogs_mmk: 0,
      operating_expenses_mmk: 0,
      total_costs_mmk: 0,
      revenue_record_count: 1,
      operating_expense_record_count: 0,
    },
    {
      period: { start: "2026-10-01", end: "2026-10-22" },
      revenue_mmk: "150.75",
      cogs_mmk: "50.25",
      operating_expenses_mmk: "20.10",
      total_costs_mmk: "70.35",
      revenue_record_count: 2,
      operating_expense_record_count: 1,
    },
  ],
};

describe("CashflowTrendChart", () => {
  it("distinguishes empty months from recorded zeroes and marks a partial month", () => {
    render(<CashflowTrendChart trends={trends} />);

    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[1]!).getAllByText("No records")).toHaveLength(2);
    expect(within(rows[2]!).getAllByText("0 MMK")).toHaveLength(2);
    expect(within(rows[2]!).getByText("1 record")).toBeTruthy();
    expect(within(rows[3]!).getByText("Partial")).toBeTruthy();
    expect(within(rows[3]!).getByText("150.75 MMK")).toBeTruthy();
    expect(within(rows[3]!).getByText("70.35 MMK")).toBeTruthy();
    expect(screen.getByText("Revenue vs Total Costs")).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: "Total costs" })).toBeTruthy();
    expect(screen.getByText(/latest period, 2026-10-01–2026-10-22, is partial/i)).toBeTruthy();
    expect(screen.getByText(/total costs include cost of goods sold \(COGS\)/i)).toBeTruthy();
    expect(screen.getByText(/revenue is not profit/i)).toBeTruthy();
  });

  it("shows unavailable values without converting them to zero", () => {
    const unavailable: Trends = {
      ...trends,
      points: [
        {
          ...trends.points[2]!,
          revenue_mmk: null,
          revenue_record_count: 1,
        },
      ],
    };
    render(<CashflowTrendChart trends={unavailable} />);

    expect(within(screen.getByRole("table")).getByText("Unavailable")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("70.35 MMK")).toBeTruthy();
  });

  it("leaves total costs unavailable when historical sale cost is missing", () => {
    render(
      <CashflowTrendChart
        trends={{
          ...trends,
          points: [{ ...trends.points[2]!, cogs_mmk: null, total_costs_mmk: null }],
        }}
      />,
    );
    const row = within(screen.getByRole("table")).getAllByRole("row")[1]!;
    expect(within(row).getByText("150.75 MMK")).toBeTruthy();
    expect(within(row).getByText("Unavailable")).toBeTruthy();
    expect(
      within(row).getByText("Historical sale costs are missing for this period."),
    ).toBeTruthy();
    expect(within(row).queryByText("0 MMK")).toBeNull();
  });

  it("keeps the empty-activity state when all months have no records", () => {
    const noActivity: Trends = {
      ...trends,
      points: trends.points.map((point) => ({
        ...point,
        revenue_mmk: 0,
        cogs_mmk: 0,
        operating_expenses_mmk: 0,
        total_costs_mmk: 0,
        revenue_record_count: 0,
        operating_expense_record_count: 0,
      })),
    };
    render(<CashflowTrendChart trends={noActivity} />);
    expect(screen.getByRole("status").textContent).toMatch(/no revenue or cost records/i);
  });

  it("does not describe unavailable record counts as zero activity", () => {
    const unavailableCounts: Trends = {
      ...trends,
      points: [
        {
          ...trends.points[0]!,
          revenue_mmk: null,
          cogs_mmk: null,
          operating_expenses_mmk: null,
          total_costs_mmk: null,
          revenue_record_count: null,
          operating_expense_record_count: null,
        },
      ],
    };
    render(<CashflowTrendChart trends={unavailableCounts} />);
    expect(screen.getByRole("status").textContent).toMatch(/trend data is unavailable/i);
    expect(screen.getByRole("status").textContent).toMatch(/cannot confirm/i);
    expect(within(screen.getByRole("table")).getAllByText("Unavailable")).toHaveLength(2);
  });
});
