import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RecordedLoanDates } from "../components/RecordedLoanDates";
vi.mock("@/lib/i18n", () => ({useTranslation: () => ({language:"en"})}));
afterEach(cleanup);
it("shows start and estimated final dates without the internal balance date", () => {
  render(<RecordedLoanDates balance={{id:"1",lender_kind:"individual",lender_name:"Person",outstanding_principal_mmk:"1000000",as_of_date:"2026-10-23",loan_start_date:"2026-01-10",next_payment_date:"2026-11-03",remaining_term_months:12,payment_frequency:"monthly"}}/>);
  expect(screen.queryByText("Balance date")).toBeNull();
  expect(screen.getByText("Loan start date").parentElement).toHaveTextContent("01/10/2026");
  expect(screen.getByText("Loan end date").parentElement).toHaveTextContent("10/03/2027");
});
