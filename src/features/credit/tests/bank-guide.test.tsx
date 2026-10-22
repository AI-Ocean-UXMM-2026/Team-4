import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BankLoanGuide } from "../components/BankLoanGuide";

const preferences = vi.hoisted(() => ({ language: "en" }));
vi.mock("@/lib/i18n", () => ({ useTranslation: () => preferences }));
afterEach(() => { cleanup(); preferences.language = "en"; });

it("resets the product when switching banks and shows that product's source and terms", () => {
  render(<BankLoanGuide onViewRecords={() => {}} />);
  fireEvent.change(screen.getByLabelText("Loan product"), { target: { value: "jica" } });
  expect(screen.getByText("Up to 5 years")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Bank"), { target: { value: "yoma" } });
  expect(screen.getByLabelText("Loan product")).toHaveValue("sme");
  expect(screen.getByRole("link", { name: "Official product page" })).toHaveAttribute("href", "https://www.yomabank.com/en/business/sme-business-loan/");
  fireEvent.change(screen.getByLabelText("Loan product"), { target: { value: "od" } });
  expect(screen.getByText("Up to 12 months")).toBeTruthy();
  expect(screen.queryByText(/Borrower\/co-borrower/)).toBeNull();
  expect(screen.getByRole("link", { name: "Official product page" })).toHaveAttribute("href", "https://www.yomabank.com/en/business/business-overdraft/");
});

it("renders Burmese guidance and opens the user's preparation records", () => {
  preferences.language = "my";
  const viewRecords = vi.fn();
  render(<BankLoanGuide onViewRecords={viewRecords} />);
  expect(screen.getByText("ဘဏ်ချေးငွေလမ်းညွှန်")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "မိမိပြင်ဆင်မှုမှတ်တမ်းများ ကြည့်ရန်" }));
  expect(viewRecords).toHaveBeenCalledOnce();
});
