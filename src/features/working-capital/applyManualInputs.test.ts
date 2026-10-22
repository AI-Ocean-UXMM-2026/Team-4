import { describe, expect, it } from "vitest";
import { applyManualInputs, needsWorkingCapitalInput } from "./applyManualInputs";
import type { WorkingCapitalSnapshot } from "./hooks/useWorkingCapital";

const snapshot: WorkingCapitalSnapshot = {
  business_id: "biz",
  as_of: "2026-10-20",
  source_version: 1,
  available_cash_mmk: "1000000",
  inventory: [
    {
      product_id: "p1",
      name: "Clip",
      current_stock_qty: "20",
      unit_cost_mmk: "100",
      average_units_sold_per_day_7: null,
      average_units_sold_per_day_30: "2",
      coverage_days: "10",
      stockout_risk: null,
      status: "insufficient_data",
      slow_moving: false,
      slow_moving_rule: "",
    },
  ],
  purchasing_budget: { status: "insufficient_data", budget_mmk: null },
  unlock_cash: {
    as_of: "2026-10-20",
    stock_value_mmk: "2000",
    receivables_mmk: "500",
    expense_candidates: [],
    average_weekly_running_cost_mmk: null,
  },
  warnings: [],
};

describe("manual working-capital planning", () => {
  it("recalculates dependent values without changing the imported snapshot", () => {
    const display = applyManualInputs(snapshot, {
      availableCashMmk: null,
      supplierLeadDays: 7,
      mandatoryMonthlyPaymentsMmk: "200000",
      monthlyEssentialCostsMmk: "200000",
      protectedReserveMmk: "300000",
      dedicatedReserveMmk: "0",
      stockLevels: { p1: "10" },
    });
    expect(display.purchasing_budget.budget_mmk).toBe("500000.00");
    expect(display.inventory[0]?.coverage_days).toBe("5.0");
    expect(display.inventory[0]?.stockout_risk).toBe(true);
    expect(display.inventory[0]?.manualStock).toBe(true);
    expect(display.unlock_cash.stock_value_mmk).toBe("1000.00");
    expect(snapshot.inventory[0]?.current_stock_qty).toBe("20");
    expect(needsWorkingCapitalInput(display)).toBe(false);
  });

  it("keeps the budget unavailable when recorded cash is missing", () => {
    const display = applyManualInputs(
      { ...snapshot, available_cash_mmk: null },
      {
        availableCashMmk: null,
        supplierLeadDays: 7,
        mandatoryMonthlyPaymentsMmk: "0",
        monthlyEssentialCostsMmk: "0",
        protectedReserveMmk: "0",
        dedicatedReserveMmk: "0",
        stockLevels: {},
      },
    );
    expect(display.purchasing_budget.budget_mmk).toBeNull();
    expect(display.manualBudget).toBe(false);
    expect(needsWorkingCapitalInput(display)).toBe(true);
  });

  it("uses manual cash only when recorded cash is unavailable", () => {
    const inputs = {
      availableCashMmk: "5000000",
      supplierLeadDays: 7,
      mandatoryMonthlyPaymentsMmk: "500000",
      monthlyEssentialCostsMmk: "500000",
      protectedReserveMmk: "3000000",
      dedicatedReserveMmk: "0",
      stockLevels: {},
    };
    const manual = applyManualInputs({ ...snapshot, available_cash_mmk: null }, inputs);
    expect(manual.purchasing_budget.budget_mmk).toBe("1500000.00");
    expect(manual.manualCash).toBe(true);
    expect(needsWorkingCapitalInput(manual)).toBe(false);
    const imported = applyManualInputs(snapshot, inputs);
    expect(imported.purchasing_budget.budget_mmk).toBe("0.00");
    expect(imported.manualCash).toBe(false);
  });
});
