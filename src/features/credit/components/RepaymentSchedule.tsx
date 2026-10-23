import { useTranslation } from "@/lib/i18n";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { Loan } from "../types";

const money = (value: string) => `${Number(value).toLocaleString("en-US")} MMK`;
const date = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
};

export function RepaymentSchedule({ loan }: { loan: Loan }) {
  const { t } = useTranslation();
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const expanded = expandedLoanId === loan.loan_id;

  if (loan.schedule_status !== "available") {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {loan.schedule_explanation}
      </p>
    );
  }
  return (
    <section className="bf-card">
        <h3 className="font-semibold">
          {t("Modelled schedule ·")} {loan.loan_id}
        </h3>
        <p className="mt-3 text-sm text-muted-foreground">
          {t(
            "Scheduled obligations are estimates. They are kept separate from actual imported payments.",
          )}
        </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="p-2">{t("Due")} (MM/DD/YYYY)</th>
              <th className="p-2">{t("Instalment · scheduled")}</th>
              <th className="p-2">{t("Principal")}</th>
              <th className="p-2">{t("Interest")}</th>
              <th className="p-2">{t("Projected balance")}</th>
            </tr>
          </thead>
          <tbody>
            {(expanded ? loan.schedule : loan.schedule.slice(0, 5)).map((line) => (
              <tr className="border-b last:border-0" key={line.period}>
                <td className="p-2">{date(line.due_date)}</td>
                <td className="p-2">{money(line.scheduled_installment_mmk)}</td>
                <td className="p-2">{money(line.principal_due_mmk)}</td>
                <td className="p-2">{money(line.interest_due_mmk)}</td>
                <td className="p-2">{money(line.projected_principal_mmk)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loan.schedule.length > 5 && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpandedLoanId(expanded ? null : loan.loan_id)}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t(expanded ? "Show fewer months" : "Show remaining months")}
          <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </section>
  );
}
