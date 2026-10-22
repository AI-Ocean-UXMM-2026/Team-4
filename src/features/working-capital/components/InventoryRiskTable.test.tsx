import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InventoryRiskTable } from "./InventoryRiskTable";
import type { InventoryRisk } from "../hooks/useWorkingCapital";

vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ t: (text: string) => text }) }));
afterEach(cleanup);

const product: InventoryRisk = {
  product_id: "p1",
  name: "Hair clip",
  current_stock_qty: "182",
  average_units_sold_per_day_7: "2.42857142857",
  average_units_sold_per_day_30: "1.700",
  coverage_days: "107.1",
  stockout_risk: null,
  status: "insufficient_data",
  slow_moving: false,
  slow_moving_rule: "",
};

describe("InventoryRiskTable", () => {
  it("shows only the 30-day daily average with two decimal places", () => {
    render(<InventoryRiskTable items={[product]} />);
    expect(screen.getByText("Average daily sales (last 30 days)")).toBeTruthy();
    expect(screen.getByText("1.70")).toBeTruthy();
    expect(screen.queryByText(/2\.428/)).toBeNull();
  });

  it("shows a dash for a missing average and formats a numeric average", () => {
    render(
      <InventoryRiskTable
        items={[
          { ...product, average_units_sold_per_day_30: null },
          { ...product, product_id: "p2", name: "Bow", average_units_sold_per_day_30: 2.42857 },
        ]}
      />,
    );
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("2.43")).toBeTruthy();
  });

  it("shows green, yellow, and red badges around the supplier lead time and buffer", () => {
    render(
      <InventoryRiskTable
        items={[
          {
            ...product,
            product_id: "safe",
            coverage_days: "10.1",
            supplier_lead_days: 7,
            risk_threshold_days: 10,
            status: "observed",
          },
          {
            ...product,
            product_id: "soon",
            coverage_days: "7",
            supplier_lead_days: 7,
            risk_threshold_days: 10,
            status: "observed",
          },
          {
            ...product,
            product_id: "high",
            coverage_days: "6.9",
            supplier_lead_days: 7,
            risk_threshold_days: 10,
            status: "observed",
            manualLeadTime: true,
          },
        ]}
      />,
    );
    expect(screen.getByText("Safe").className).toContain("bg-success/15");
    expect(screen.getByText("Order Soon").className).toContain("bg-warning/20");
    expect(screen.getByText("High Risk").className).toContain("bg-destructive/10");
    expect(screen.getAllByText("Source: Excel")).toHaveLength(2);
    expect(screen.getByText("Source: Manual Entry")).toBeTruthy();
  });

  it("does not claim a risk level when lead time or sales are missing", () => {
    render(
      <InventoryRiskTable
        items={[
          product,
          { ...product, product_id: "no-sales", status: "no_recent_sales", coverage_days: null },
        ]}
      />,
    );
    expect(screen.getByText("Need supplier lead time")).toBeTruthy();
    expect(screen.getAllByText("No recent sales")).toHaveLength(2);
    expect(screen.queryByText("Safe")).toBeNull();
    expect(screen.queryByText("Source: Excel")).toBeNull();
  });
});
