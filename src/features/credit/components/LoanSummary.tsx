import { useTranslation } from "@/lib/i18n";
import type { Loan } from "../types";

const mmk = (amount: string) => `${Number(amount).toLocaleString("en-US")} MMK`;
const calendarDay = (value: string) => Date.parse(`${value}T00:00:00Z`);
const displayDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
};

export function LoanSummary({ loan, asOf }: { loan: Loan; asOf: string }) {
  const { t } = useTranslation();
  const hasNextPayment = loan.schedule_status === "available" && loan.next_payment_due_mmk !== null && loan.next_due_date !== null;
  const daysRemaining = hasNextPayment
    ? Math.round((calendarDay(loan.next_due_date!) - calendarDay(asOf)) / 86400000)
    : null;
  const principal = Number(loan.principal_mmk);
  const paid = Number(loan.actual_principal_paid_mmk);
  const percent =
    principal > 0 && Number.isFinite(principal) && Number.isFinite(paid)
      ? Math.min(100, Math.max(0, (paid / principal) * 100))
      : null;
  return (
    <section
      aria-label={t("Loan summary")}
      className="rounded-2xl border border-primary/30 bg-card p-5 text-card-foreground sm:p-6"
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-xl font-bold">{loan.lender || t("Loan")}</h2>
        <p className="text-xs text-muted-foreground sm:border-l sm:pl-4">
          {t("Loan ID:")} {loan.loan_id}
        </p>
        <span className="rounded-full border border-primary/20 bg-secondary px-3 py-1 text-xs">
          {t(loan.repayment_model.replaceAll("_", " "))}
        </span>
      </header>
      <div className="mt-5">
        <section aria-label={t("Next scheduled payment")} className="min-w-0 rounded-xl border border-primary/25 bg-primary/5 p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-primary">{t("Next scheduled payment")}</h3>
          {hasNextPayment ? (
            <>
              <p className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-4xl">{mmk(loan.next_payment_due_mmk!)}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <p className="text-sm">
                  {t("Due")} (MM/DD/YYYY): <time dateTime={loan.next_due_date!} className="font-semibold">{displayDate(loan.next_due_date!)}</time>
                </p>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                  {daysRemaining === 0 ? t("Due today") : daysRemaining! > 0
                    ? t("{0} days remaining", { "0": daysRemaining! })
                    : t("{0} days past scheduled date", { "0": Math.abs(daysRemaining!) })}
                </span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t("Estimated installment. Payment status not linked to schedule.")}</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{t(loan.schedule_status === "available" ? "No future installment scheduled" : "Complete loan terms to see the next payment")}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t("As of")}: {displayDate(asOf)}</p>
        </section>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <p>{t("Loan product")}: <strong>{loan.loan_product || t("Not recorded")}</strong></p>
        <p>{t("Agreed annual interest rate")}: <strong>{loan.annual_rate_pct !== null ? `${Number(loan.annual_rate_pct)}%` : t("Not recorded")}</strong></p>
        <p>{t("Term (months)")}: <strong>{loan.term_months ?? t("Not recorded")}</strong></p>
        <p>{t("First payment date")}: <strong>{loan.first_payment_date || t("Not recorded")}</strong></p>
        <p>{t("Payment frequency")}: <strong>{loan.payment_frequency ? t(loan.payment_frequency) : t("Not recorded")}</strong></p>
      </div>
      <div className="my-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="min-w-0 border-l pl-4">
            <p className="text-xs text-muted-foreground">{t("Outstanding principal")}</p>
            <p className="mt-1 break-words text-lg font-semibold sm:text-xl">
              {mmk(loan.outstanding_principal_mmk)}
            </p>
          </div>
          <div className="min-w-0 border-l pl-4">
            <p className="text-xs text-muted-foreground">{t("Original principal")}</p>
            <p className="mt-1 break-words text-lg font-semibold sm:text-xl">
              {mmk(loan.principal_mmk)}
            </p>
          </div>
          <div className="min-w-0 border-l pl-4">
            <p className="text-xs text-muted-foreground">{t("Principal repaid")}</p>
            <p className="mt-1 break-words text-lg font-semibold sm:text-xl">
              {mmk(loan.actual_principal_paid_mmk)}
            </p>
          </div>
        </div>
      </div>
      {percent !== null && (
        <div>
          <div
            role="progressbar"
            aria-label={t("Principal repayment progress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-xs">
            {t("{0}% of principal repaid", { "0": percent.toFixed(1) })}
          </p>
        </div>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        {t("Actual interest paid")}:{" "}
        <span className="text-lg font-semibold text-foreground sm:text-xl">
          {mmk(loan.actual_interest_paid_mmk)}
        </span>
      </p>
    </section>
  );
}
