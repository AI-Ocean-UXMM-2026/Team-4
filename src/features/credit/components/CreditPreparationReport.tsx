import { useTranslation } from "@/lib/i18n";
import type { CreditSummary, Loan } from "../types";
import { importedApplication } from "../importedApplication";
import { applicationProductName } from "./BankLoanGuide";

export function CreditPreparationReport({
  report,
  loan,
}: {
  report: CreditSummary["preparation_report"];
  loan?: Loan | undefined;
}) {
  const { t } = useTranslation();
  const application = importedApplication(loan);

  return (
    <section className="rounded-xl border bg-card p-5 print:border-0 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("Borrower preparation summary")}</h2>
          <p className="text-sm text-muted-foreground">
            {application
              ? `${loan?.lender} · ${applicationProductName(application)}`
              : t("Imported business records")}
          </p>
        </div>
        <button type="button" className="bf-button print:hidden" onClick={() => window.print()}>
          {t("Print / save report")}
        </button>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <p>
          <strong>{t("Business:")}</strong> {report.business_profile?.name || t("Not recorded")}
          {report.business_profile?.industry ? ` · ${report.business_profile.industry}` : ""}
          {report.business_profile?.city ? ` · ${report.business_profile.city}` : ""}
        </p>
        <p>
          <strong>{t("Records covered:")}</strong>{" "}
          {report.period_covered.start || t("No start date")} –{" "}
          {report.period_covered.end || t("No end date")}
        </p>
        <p>
          <strong>{t("Financial summary:")}</strong> {report.financial_summary.note}
        </p>
        <p>
          <strong>{t("Outstanding loans:")}</strong>{" "}
          {report.outstanding_loans.length
            ? report.outstanding_loans
                .map(
                  (loan) =>
                    `${loan.loan_id}: ${Number(loan.outstanding_principal_mmk).toLocaleString("en-US")} MMK`,
                )
                .join("; ")
            : t("No loans recorded")}
        </p>
        <p>
          <strong>{t("Missing preparation items:")}</strong>{" "}
          {report.missing_records.length
            ? report.missing_records.join(", ")
            : t("No missing categories identified from available records")}
        </p>
      </div>
      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">{report.disclaimer}</p>
    </section>
  );
}
