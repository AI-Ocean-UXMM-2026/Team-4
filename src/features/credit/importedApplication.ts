import catalog from "../../../shared/contracts/loan-products.json";
import type { GuideSelection } from "./components/BankLoanGuide";
import type { Loan } from "./types";

export function importedApplication(
  loan?: Pick<Loan, "bank_id" | "loan_product_id" | "lender" | "loan_product">,
): GuideSelection | null {
  if (!loan) return null;
  const bank = loan.bank_id
    ? catalog.banks.find((item) => item.id === loan.bank_id)
    : catalog.banks.find((item) => item.aliases.includes(loan.lender.trim().toLowerCase()));
  if (!bank) return null;
  const product = loan.loan_product_id
    ? bank.products.find((item) => item.id === loan.loan_product_id)
    : bank.products.find(
        (item) => item.name.toLowerCase() === loan.loan_product?.trim().toLowerCase(),
      );
  return product ? { bank: bank.id, productId: product.id.slice(bank.id.length + 1) } : null;
}
