export type Period = { start: string; end: string };
export type Money = string | number | null;
export type Obligation = {
  kind: "supplier" | "expense" | "loan";
  reference_id: string;
  due_date: string | null;
  amount_mmk: string | number;
};
export type FinancialSnapshot = {
  business_id: string;
  period: Period;
  actual: {
    revenue_mmk: Money;
    cogs_mmk: Money;
    gross_profit_mmk: Money;
    operating_expenses_mmk: Money;
    operating_profit_mmk: Money;
    interest_expenses_mmk: Money;
    profit_before_tax_mmk: Money;
    cash_balance_mmk: Money;
    receivables_mmk: Money;
    payables_mmk: Money;
  };
  upcoming_obligations: Obligation[];
  data_quality: {
    status: "complete" | "partial" | "missing_data";
    missing_sheets: string[];
    warnings: string[];
  };
  as_of: string | null;
  import_batch_id: string | null;
  source_version?: number | null;
  synthetic?: boolean;
};
export type Trends = {
  business_id: string;
  points: {
    period: Period;
    revenue_mmk: Money;
    operating_expenses_mmk: Money;
    revenue_record_count: number | null;
    operating_expense_record_count: number | null;
  }[];
  as_of: string | null;
  import_batch_id: string | null;
  source_version?: number | null;
  synthetic?: boolean;
};
/** P5 supplies its common authenticated client through this interface. */
export interface FinancialClient {
  summary(businessId: string, period: Period, signal: AbortSignal): Promise<FinancialSnapshot>;
  trends(businessId: string, end: string, signal: AbortSignal): Promise<Trends>;
}
export const formatMmk = (value: Money) => {
  if (value === null) return "Unavailable";
  const text = String(value);
  if (!/^-?\d+(\.\d+)?$/.test(text)) return "Unavailable";
  const [whole = "0", fraction = ""] = text.split(".");
  const cents = fraction.replace(/0+$/, "");
  return `${whole === "-0" ? "-0" : BigInt(whole).toLocaleString("en-US")}${cents ? `.${cents}` : ""} MMK`;
};
