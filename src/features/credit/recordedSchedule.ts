import type { CreditSummary } from "./types";
export type RecordedBalance = NonNullable<CreditSummary["recorded_balances"]>[number];
export function estimatedFinalPaymentDate(balance: RecordedBalance): string | null {
  if (balance.payment_frequency !== "monthly" || !balance.next_payment_date || !balance.remaining_term_months) return null;
  const [year, month, day] = balance.next_payment_date.split("-").map(Number) as [number, number, number];
  const end = new Date(Date.UTC(year, month - 1 + balance.remaining_term_months - 1, 1));
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end.toISOString().slice(0,10);
}
export function recordedSchedule(balance: RecordedBalance) {
  if (balance.payment_frequency !== "monthly" || !balance.next_payment_date || !balance.next_payment_mmk || balance.annual_rate_pct == null || !balance.remaining_term_months) return null;
  const terms = balance.repayment_terms;
  if (terms && (terms.interest_method !== "reducing_balance" || Number(terms.balloon_payment_mmk) > 0)) return null;
  const rate = Number(balance.annual_rate_pct) / 1200;
  const installment = Number(terms?.regular_payment_mmk ?? balance.next_payment_mmk);
  let outstanding = Number(balance.outstanding_principal_mmk);
  const [year, month, day] = balance.next_payment_date.split("-").map(Number) as [number, number, number];
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const rows = [];
  for (let i = 0; i < balance.remaining_term_months && outstanding > 0; i++) {
    const interest = round(outstanding * rate);
    const payment = round(Math.min(installment, outstanding + interest));
    const principal = round(payment - interest);
    outstanding = round(outstanding - principal);
    const target = new Date(Date.UTC(year, month - 1 + i, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    rows.push({period: i + 1, date: target.toISOString().slice(0,10), payment, principal, interest, outstanding});
  }
  return rows;
}
