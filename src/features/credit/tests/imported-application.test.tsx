import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { importedApplication } from "../importedApplication";
import { BankLoanGuide } from "../components/BankLoanGuide";
import { CreditPrintReport } from "../components/CreditPrintReport";
import type { CreditSummary, Loan } from "../types";

vi.mock("../components/ApplicationFiles", () => ({
  ApplicationFiles: () => <div>Application checklist</div>,
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({ language: "en", t: (key: string) => key }),
}));
afterEach(cleanup);

it("reopens a saved document application with the matching bank and product", () => {
  const change = vi.fn();
  render(<BankLoanGuide preparationOnly onViewRecords={() => {}} onSelectionChange={change} savedSelections={[{id:"yoma:yoma-od",label:"Yoma Bank · Business Overdraft · 2 files",selection:{bank:"yoma",productId:"od"}}]} />);
  fireEvent.change(screen.getByLabelText("Saved applications"), {target:{value:"yoma:yoma-od"}});
  expect(change).toHaveBeenCalledWith({bank:"yoma",productId:"od"});
});

it("prints the imported Yoma product requirements instead of a generic checklist", () => {
  const loan = {
    lender: "Yoma Bank",
    bank_id: "yoma",
    loan_product_id: "yoma-sme",
    loan_id: "Y-1",
  } as Loan;
  const data = {
    preparation_report: {
      business_profile: { name: "Shop" },
      period_covered: { start: null, end: null },
    },
    as_of: "2026-10-22",
    readiness: [],
    loans: [],
    readiness_progress: { prepared_categories: 0, total_categories: 0 },
    data_quality: { limitations: [] },
    repayment_capacity: {
      explanation: "Recorded cash planning",
      projected_cash_available_before_loan_mmk: "700",
    },
  } as unknown as CreditSummary;
  render(<CreditPrintReport data={data} loan={loan} files={[{
    id: "attachment-1", requirement_key: "doc-0", filename: "updated-license.pdf", size: 2048,
    created_at: "2026-10-22T12:00:00Z",
  }]} />);
  expect(screen.getByText(/updated-license\.pdf/)).toBeTruthy();
  expect(screen.getByText("Uploaded application files")).toBeTruthy();
  expect(screen.getAllByText(/10\/22\/2026, 06:30 PM/).length).toBeGreaterThan(0);
  expect(screen.getByText("Yoma Bank · SME Business Loan")).toBeTruthy();
  expect(screen.getByText("Bank statements for the last year")).toBeTruthy();
  expect(screen.queryByText("Generic preparation checklist · not lender-specific")).toBeNull();
  expect(screen.getByText("Recorded cash planning")).toBeTruthy();
});

it("shows Yoma requirements from the imported bank and product", () => {
  const selection = importedApplication({
    lender: "Yoma Bank",
    bank_id: "yoma",
    loan_product_id: "yoma-sme",
  });
  expect(selection).toEqual({ bank: "yoma", productId: "sme" });
  render(<BankLoanGuide selection={selection!} onViewRecords={() => {}} />);
  expect(screen.getByText("Bank statements for the last year")).toBeTruthy();
  expect(screen.queryByText("Financial statements for the last 3 years")).toBeNull();
});

it("maps legacy bank and product names without guessing a product", () => {
  expect(
    importedApplication({ lender: " Yoma Bank ", loan_product: "Business Overdraft" }),
  ).toEqual({ bank: "yoma", productId: "od" });
  expect(importedApplication({ lender: "KBZ Bank", loan_product_id: "kbz-jica" })).toEqual({
    bank: "kbz",
    productId: "jica",
  });
  expect(importedApplication({ lender: "Yoma Bank" })).toBeNull();
  expect(importedApplication({ lender: "Other Bank", loan_product: "SME Term Loan" })).toBeNull();
  expect(
    importedApplication({ lender: "Yoma Bank", bank_id: "yoma", loan_product_id: "kbz-term" }),
  ).toBeNull();
  expect(importedApplication()).toBeNull();
});
