import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LoanSummary } from "../components/LoanSummary";
import type { Loan } from "../types";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string, args: Record<string, unknown> = {}) =>
    key.replace(/\{(\w+)\}/g, (_, name) => String(args[name])) }),
}));
afterEach(cleanup);
const loan: Loan = {
  loan_id: "LOAN-001", lender: "KBZ Bank", loan_product: "SME Term Loan",
  repayment_model: "reducing_balance", principal_mmk: "12000000", disbursement_date: "2026-10-03",
  annual_rate_pct: "12", term_months: 24, actual_principal_paid_mmk: "800000",
  actual_interest_paid_mmk: "355000", outstanding_principal_mmk: "11200000",
  schedule_status: "available", schedule_explanation: null, schedule: [], actual_payments: [],
  next_due_date: "2026-11-03", next_payment_due_mmk: "564881", next_payment_status: "unknown",
};

it("shows the payment, explicit date format and calendar countdown before loan details", () => {
  render(<LoanSummary loan={loan} asOf="2026-10-22" />);
  const next = screen.getByRole("region", { name: "Next scheduled payment" });
  expect(within(next).getByText("564,881 MMK")).toBeTruthy();
  expect(within(next).getByText("11/03/2026")).toBeTruthy();
  expect(within(next).getByText(/MM\/DD\/YYYY/)).toBeTruthy();
  expect(within(next).getByText("12 days remaining")).toBeTruthy();
  expect(next.compareDocumentPosition(screen.getByText("Loan product", { exact: false })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText("11,200,000 MMK")).toBeTruthy();
});

it("shows due today without marking the installment unpaid", () => {
  render(<LoanSummary loan={loan} asOf="2026-11-03" />);
  expect(screen.getByText("Due today")).toBeTruthy();
  expect(screen.queryByText(/overdue|unpaid/i)).toBeNull();
});

it("counts calendar days across a daylight-saving boundary", () => {
  render(<LoanSummary loan={{ ...loan, next_due_date: "2026-03-09" }} asOf="2026-03-07" />);
  expect(screen.getByText("2 days remaining")).toBeTruthy();
});

it("does not invent a next payment when loan terms are missing", () => {
  render(<LoanSummary loan={{ ...loan, schedule_status: "missing_terms", next_due_date: null, next_payment_due_mmk: null }} asOf="2026-10-22" />);
  expect(screen.getByText("Complete loan terms to see the next payment")).toBeTruthy();
  expect(screen.queryByText(/days remaining/)).toBeNull();
  expect(screen.getByText("11,200,000 MMK")).toBeTruthy();
});
