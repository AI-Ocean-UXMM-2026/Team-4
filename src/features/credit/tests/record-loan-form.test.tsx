import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { LoanRecording, RecordLoanForm } from "../components/RecordLoanForm";
const mocks = vi.hoisted(() => ({api: vi.fn()}));
vi.mock("@/lib/apiClient", () => ({api: mocks.api}));
vi.mock("@/lib/i18n", () => ({useTranslation: () => ({language: "en"})}));
afterEach(() => {cleanup(); mocks.api.mockReset();});
function form() {
  const cache = new QueryClient();
  return render(<QueryClientProvider client={cache}><RecordLoanForm businessId="mine" /></QueryClientProvider>);
}
it("opens another loan form only on request and allows cancelling", () => {
  render(<QueryClientProvider client={new QueryClient()}><LoanRecording businessId="mine" hasLoans /></QueryClientProvider>);
  expect(screen.queryByRole("spinbutton")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "Record another loan"}));
  expect(screen.getByRole("spinbutton")).toBeVisible();
  fireEvent.click(screen.getByRole("button", {name: "Cancel"}));
  expect(screen.queryByRole("spinbutton")).toBeNull();
});
it("collapses the first loan form after saving and keeps the success confirmation", async () => {
  mocks.api.mockResolvedValue({id: "saved"});
  render(<QueryClientProvider client={new QueryClient()}><LoanRecording businessId="mine" hasLoans={false} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText("Bank name"), {target: {value: "Yoma Bank"}});
  fireEvent.change(screen.getByRole("spinbutton"), {target: {value: "5000000"}});
  fireEvent.click(screen.getByRole("button", {name: "Save loan"}));
  expect(await screen.findByRole("button", {name: "Record another loan"})).toBeVisible();
  expect(screen.queryByRole("spinbutton")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Loan balance saved.");
});
it("shows products for the selected bank and resets the product when changing banks", () => {
  form();
  fireEvent.change(screen.getByLabelText("Bank name"), {target: {value: "KBZ Bank"}});
  fireEvent.change(screen.getByLabelText("Loan product (optional)"), {target: {value: "JICA Two Steps Loan"}});
  fireEvent.change(screen.getByLabelText("Bank name"), {target: {value: "Yoma Bank"}});
  expect(screen.getByLabelText("Loan product (optional)")).toHaveValue("");
});
it("saves the selected bank and product with the stated balance", async () => {
  mocks.api.mockResolvedValue({id: "saved"});
  form();
  fireEvent.change(screen.getByLabelText("Bank name"), {target: {value: "KBZ Bank"}});
  fireEvent.change(screen.getByLabelText("Loan product (optional)"), {target: {value: "SME Term Loan"}});
  fireEvent.change(screen.getByRole("spinbutton"), {target: {value: "1000000"}});
  fireEvent.click(screen.getByRole("button", {name: "Save loan"}));
  await waitFor(() => expect(mocks.api).toHaveBeenCalledOnce());
  const payload = JSON.parse(mocks.api.mock.calls[0]![1].body);
  expect(payload.bank_id).toBe("kbz"); expect(payload.loan_product_id).toBe("kbz-term");
  expect(payload.outstanding_principal_mmk).toBe("1000000");
});
it("accepts manually entered bank and loan product names", async () => {
  mocks.api.mockResolvedValue({id: "saved"});
  form();
  fireEvent.change(screen.getByLabelText("Bank name"), {target: {value: "My Local Bank"}});
  expect(screen.getByRole("alert")).toHaveTextContent("Analysis will use only the balance and repayment details you enter manually");
  fireEvent.change(screen.getByLabelText("Loan product (optional)"), {target: {value: "Shop Expansion Loan"}});
  fireEvent.change(screen.getByRole("spinbutton"), {target: {value: "2500000"}});
  fireEvent.click(screen.getByRole("button", {name: "Save loan"}));
  await waitFor(() => expect(mocks.api).toHaveBeenCalledOnce());
  const payload = JSON.parse(mocks.api.mock.calls[0]![1].body);
  expect(payload.lender_name).toBe("My Local Bank");
  expect(payload.bank_id).toBeNull();
  expect(payload.loan_product_id).toBe("Shop Expansion Loan");
});
