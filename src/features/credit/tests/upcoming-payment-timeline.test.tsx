import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { CreditSummary } from "../types";
import { UpcomingPaymentTimeline } from "../components/UpcomingPaymentTimeline";

vi.mock("@/lib/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

const summary = { as_of: "2026-10-23", loans: [{ loan_id: "loan-1", lender: "KBZ Bank", next_due_date: "2026-10-28", next_payment_due_mmk: "125000", schedule_status: "available", schedule: [
  { period: 1, due_date: "2026-10-28", scheduled_installment_mmk: "125000" },
  { period: 2, due_date: "2026-11-28", scheduled_installment_mmk: "125000" },
  { period: 3, due_date: "2026-12-28", scheduled_installment_mmk: "125000" },
] }], recorded_balances: [{ id: "balance-1", lender_name: "Family lender", next_payment_date: "2026-10-20", next_payment_mmk: "50000" }] } as CreditSummary;

it("shows due dates and statuses in the selected timeline", () => {
  render(<UpcomingPaymentTimeline data={summary} />);
  expect(screen.getByText("3 days overdue")).toBeTruthy();
  expect(screen.getByText("Due in 5 days")).toBeTruthy();
  expect(screen.queryByText("Nov 28, 2026")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next 90 days" }));
  expect(screen.getByText("Nov 28, 2026")).toBeTruthy();
  expect(screen.getByText("Dec 28, 2026")).toBeTruthy();
});

it("explains when no next payment details have been added", () => {
  render(<UpcomingPaymentTimeline data={{ ...summary, loans: [], recorded_balances: [{ ...summary.recorded_balances![0], next_payment_date: null, next_payment_mmk: null } as any] }} />);
  expect(screen.getByText("No next payment details have been added yet. Add a payment date and amount to see the timeline.")).toBeTruthy();
});

it("explains when recorded payments fall outside the selected period", () => {
  render(<UpcomingPaymentTimeline data={{ ...summary, loans: [], recorded_balances: [{ ...summary.recorded_balances![0], next_payment_date: "2027-01-23" } as any] }} />);
  expect(screen.getByText("No recorded loan payments are due in this period.")).toBeTruthy();
});
