import { expect, it } from "vitest";
import type { CreditSummary } from "../types";
import { paymentReminders } from "./PaymentReminderNotifier";

const summary = {
  loans: [
    { loan_id: "soon", lender: "KBZ Bank", next_due_date: "2026-10-28", next_payment_due_mmk: "125000" },
    { loan_id: "later", lender: "Yoma Bank", next_due_date: "2026-11-10", next_payment_due_mmk: "200000" },
  ],
  recorded_balances: [
    { id: "today", lender_name: "Family lender", next_payment_date: "2026-10-23", next_payment_mmk: "50000" },
    { id: "past", lender_name: "Old lender", next_payment_date: "2026-10-20", next_payment_mmk: "50000" },
  ],
} as CreditSummary;

it("notifies only for payments due today or within seven days", () => {
  expect(paymentReminders(summary, "2026-10-23")).toEqual([
    expect.objectContaining({ id: "balance-today", daysUntilDue: 0 }),
    expect.objectContaining({ id: "loan-soon", daysUntilDue: 5 }),
  ]);
});
