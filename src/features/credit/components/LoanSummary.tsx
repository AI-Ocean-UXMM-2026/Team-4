import { useTranslation } from "@/lib/i18n";
import type { Loan } from "../types";

const mmk = (amount: string) => `${Number(amount).toLocaleString("en-US")} MMK`;

export function LoanSummary({ loan }: { loan: Loan }) {
  const { t } = useTranslation();
  const principal = Number(loan.principal_mmk);
  const paid = Number(loan.actual_principal_paid_mmk);
  const percent =
    principal > 0 && Number.isFinite(principal) && Number.isFinite(paid)
      ? Math.min(100, Math.max(0, (paid / principal) * 100))
      : null;
  return (
    <section
      aria-label={t("Loan summary")}
      className="rounded-2xl border border-violet-400/30 bg-card p-5 text-card-foreground sm:p-6"
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-xl font-bold">{loan.lender || t("Loan")}</h2>
        <p className="text-xs text-muted-foreground sm:border-l sm:pl-4">
          {t("Loan ID:")} {loan.loan_id}
        </p>
        <span className="rounded-full border border-violet-400/20 bg-secondary px-3 py-1 text-xs">
          {t(loan.repayment_model.replaceAll("_", " "))}
        </span>
      </header>
      <div className="my-6 grid items-center gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{t("Outstanding principal")}</p>
          <p className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-4xl">
            {mmk(loan.outstanding_principal_mmk)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0 border-l pl-4">
            <p className="text-xs text-muted-foreground">{t("Original principal")}</p>
            <p className="mt-1 break-words text-lg font-semibold sm:text-xl">{mmk(loan.principal_mmk)}</p>
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
            <div
              className="h-full rounded-full bg-violet-500 dark:bg-violet-400"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs">
            {t("{0}% of principal repaid", { "0": percent.toFixed(1) })}
          </p>
        </div>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        {t("Actual interest paid")}:{" "}
        <span className="text-lg font-semibold text-foreground sm:text-xl">{mmk(loan.actual_interest_paid_mmk)}</span>
      </p>
      {loan.schedule_status === "available" && loan.next_payment_due_mmk !== null && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-sm">
          <p>
            {t("Next scheduled payment:")} <strong>{mmk(loan.next_payment_due_mmk)}</strong>
          </p>
          <p>
            {t("Due:")} <strong>{loan.next_due_date}</strong>
          </p>
          <p>{t("Payment status not linked to schedule")}</p>
        </div>
      )}
    </section>
  );
}
