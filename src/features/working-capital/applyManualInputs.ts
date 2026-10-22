import type { InventoryRisk, WorkingCapitalSnapshot } from "./hooks/useWorkingCapital";
import type { ManualWorkingCapitalInputs } from "./manualInputs";

export type DisplayInventoryRisk = InventoryRisk & {
  manualStock?: boolean;
  manualLeadTime?: boolean;
};
export type DisplaySnapshot = WorkingCapitalSnapshot & {
  inventory: DisplayInventoryRisk[];
  manualBudget: boolean;
  manualCash: boolean;
};

export function needsWorkingCapitalInput(display: DisplaySnapshot | null): boolean {
  return (
    !display ||
    display.purchasing_budget.budget_mmk == null ||
    !display.inventory.length ||
    display.inventory.some((item) => item.stockout_risk === null)
  );
}

function scaled(value: string | number, decimals: number): bigint | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (!match || (match[3]?.length ?? 0) > decimals) return null;
  const whole = BigInt(match[2]!);
  const fraction = BigInt((match[3] ?? "").padEnd(decimals, "0"));
  return (match[1] === "-" ? -1n : 1n) * (whole * 10n ** BigInt(decimals) + fraction);
}

function asMmk(value: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals - 2);
  const cents = (value < 0n ? value - divisor / 2n : value + divisor / 2n) / divisor;
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function applyManualInputs(
  snapshot: WorkingCapitalSnapshot,
  inputs: ManualWorkingCapitalInputs | null,
  safetyBufferDays = 3,
): DisplaySnapshot {
  if (!inputs) return { ...snapshot, manualBudget: false, manualCash: false };
  const adjustedStockValue =
    snapshot.unlock_cash.stock_value_mmk == null
      ? null
      : scaled(snapshot.unlock_cash.stock_value_mmk, 5);
  let stockValue8 = adjustedStockValue === null ? null : adjustedStockValue * 1000n;
  const inventory = snapshot.inventory.map((item): DisplayInventoryRisk => {
    const stockOverride = inputs.stockLevels[item.product_id];
    const manualStock = stockOverride !== undefined;
    const stock = manualStock ? Number(stockOverride) : Number(item.current_stock_qty);
    const dailySales =
      item.average_units_sold_per_day_30 == null
        ? null
        : Number(item.average_units_sold_per_day_30);
    const coverage = dailySales && dailySales > 0 ? stock / dailySales : null;
    if (manualStock && stockValue8 !== null) {
      const cost = item.unit_cost_mmk == null ? null : scaled(item.unit_cost_mmk, 5);
      const original = scaled(item.current_stock_qty, 3);
      const replacement = scaled(stockOverride!, 3);
      stockValue8 =
        cost !== null && original !== null && replacement !== null
          ? stockValue8 + (replacement - original) * cost
          : null;
    }
    return {
      ...item,
      current_stock_qty: stockOverride ?? item.current_stock_qty,
      coverage_days: coverage === null ? null : coverage.toFixed(1),
      supplier_lead_days: inputs.supplierLeadDays,
      risk_threshold_days: inputs.supplierLeadDays + safetyBufferDays,
      stockout_risk:
        coverage === null ? null : coverage < inputs.supplierLeadDays + safetyBufferDays,
      status: coverage === null ? "no_recent_sales" : "observed",
      manualStock,
      manualLeadTime: true,
    };
  });
  const manualCash = snapshot.available_cash_mmk == null && inputs.availableCashMmk != null;
  const cashSource = snapshot.available_cash_mmk ?? inputs.availableCashMmk;
  const cash = cashSource == null ? null : scaled(cashSource, 5);
  const payments = scaled(inputs.mandatoryMonthlyPaymentsMmk, 5);
  const reserve = scaled(inputs.protectedReserveMmk, 5);
  const budget =
    cash === null || payments === null || reserve === null
      ? null
      : asMmk(cash > payments + reserve ? cash - payments - reserve : 0n, 5);
  return {
    ...snapshot,
    inventory,
    manualBudget: budget !== null,
    manualCash,
    purchasing_budget: {
      status: budget === null ? "insufficient_data" : "scenario",
      budget_mmk: budget,
    },
    unlock_cash: {
      ...snapshot.unlock_cash,
      stock_value_mmk: stockValue8 === null ? null : asMmk(stockValue8, 8),
    },
  };
}
