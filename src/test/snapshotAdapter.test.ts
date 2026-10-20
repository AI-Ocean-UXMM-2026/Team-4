import { describe, expect, it } from "vitest";
import { snapshotDisplay } from "@/lib/snapshotAdapter";
import type { Snapshot } from "@/lib/contracts";

function fixture(amount = "50000.00"): Snapshot {
  return {
    business_id: "tea-shop",
    source_version: 1,
    tables: {
      Settings: [
        {
          business_id: "tea-shop",
          business_name: "Tea",
          currency: "MMK",
          opening_date: "2026-10-01",
          opening_cash_mmk: "1000000",
        },
      ],
      Products: [],
      Sales: [],
      CustomerReceipts: [],
      Purchases: [],
      SupplierPayments: [],
      Loans: [],
      LoanPayments: [],
      CashAdjustments: [],
      Expenses: [
        {
          business_id: "tea-shop",
          expense_id: "E001",
          date: "2026-10-05",
          category: "rent",
          amount_mmk: amount,
          description: "Rent",
        },
      ],
    },
  };
}
describe("Workbook display integration", () => {
  it("editing one expense reduces cash once by the difference", () => {
    const initial = snapshotDisplay(fixture())!;
    const changed = snapshotDisplay(fixture("80000.00"))!;
    expect(initial.data.cashOut).toBe(50);
    expect(changed.data.cashOut).toBe(80);
    expect(initial.data.cash - changed.data.cash).toBe(30);
    expect(changed.days[4]?.outflow).toBe(80);
    expect(changed.days).toHaveLength(31);
  });
  it("uses prior-month cash in the next month's opening balance", () => {
    const snapshot = fixture();
    snapshot.tables.Expenses.push({
      ...snapshot.tables.Expenses[0]!,
      expense_id: "E002",
      date: "2026-11-03",
      amount_mmk: "20000",
    });
    const view = snapshotDisplay(snapshot)!;
    expect(view.initialCash).toBe(950);
    expect(view.data.cashOut).toBe(20);
    expect(view.data.cash).toBe(930);
    expect(view.days).toHaveLength(30);
  });
});
