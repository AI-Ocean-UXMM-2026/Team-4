import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RepaymentCapacity } from "./RepaymentCapacity";
import type { CreditSummary } from "../types";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

it("shows the auditable cash-after-next-payment breakdown", () => {
  const data: CreditSummary["repayment_capacity"] = {
    status: "potential_shortfall",
    recorded_cash_mmk: "1000",
    outstanding_supplier_balances_mmk: "200",
    unpaid_expenses_mmk: "100",
    next_loan_payment_mmk: "800",
    projected_cash_available_before_loan_mmk: "700",
    repayment_gap_mmk: "-100",
    explanation: "Planning estimate",
  };

  render(<RepaymentCapacity data={data} />);

  expect(screen.getByText("Cash after next payment")).toBeTruthy();
  expect(screen.getByText(/Estimated repayment shortfall:/).textContent).toContain("100 MMK");
  expect(screen.queryByText("Recorded cash")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Show calculation" }));

  expect(screen.getByText("Recorded cash").parentElement?.textContent).toContain("1,000 MMK");
  expect(screen.getByText("Outstanding supplier balances").parentElement?.textContent).toContain("200 MMK");
  expect(screen.getByText("Unpaid expenses").parentElement?.textContent).toContain("100 MMK");
  expect(screen.getByText("Next loan payment").parentElement?.textContent).toContain("800 MMK");
});

it("shows where the calculation belongs when required data is missing", () => {
  render(<RepaymentCapacity data={{
    status: "insufficient_data",
    recorded_cash_mmk: null,
    outstanding_supplier_balances_mmk: null,
    unpaid_expenses_mmk: null,
    next_loan_payment_mmk: null,
    projected_cash_available_before_loan_mmk: null,
    repayment_gap_mmk: null,
    explanation: "Add cash and the next payment to calculate this amount.",
  }} />);

  expect(screen.getByText("Cash after next payment")).toBeTruthy();
  expect(screen.getByText("Add cash and the next payment to calculate this amount.")).toBeTruthy();
});
