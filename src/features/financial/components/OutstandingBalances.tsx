import { useTranslation } from "@/lib/i18n";
import { AlertCircle, CalendarClock, CircleDollarSign } from "lucide-react";
import type { Obligation } from "../types";
import { formatMmk } from "../types";

const kindName = (kind: Obligation["kind"]) =>
  ({ supplier: "Supplier", expense: "Expense", loan: "Loan" })[kind];

export function OutstandingBalances({
  obligations,
  asAt,
}: {
  obligations: Obligation[];
  asAt: string;
}) {
  const { t } = useTranslation();

  const overdueCount = obligations.filter((item) => item.due_date && item.due_date < asAt).length;
  return (
    <section
      className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[0_4px_18px_rgba(15,23,42,.035)] sm:p-5"
      aria-label={t("Outstanding obligations")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">
            {t("Business obligations")}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {t("Outstanding payments")}
          </h2>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-primary ring-1 ring-border">
          <CircleDollarSign size={18} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">
        {t("Recorded balances through")} {asAt}
        {t(". Due dates may be unavailable.")}
      </p>
      {overdueCount > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          <AlertCircle size={16} aria-hidden="true" />
          {overdueCount} {overdueCount === 1 ? t("payment is") : t("payments are")}{" "}
          {t("past the recorded due date")}
        </p>
      )}
      {obligations.length === 0 ? (
        <div className="mt-5 rounded-xl bg-muted px-4 py-7 text-center">
          <CalendarClock size={22} className="mx-auto text-slate-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            {t("No obligations in available records")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("This list reflects imported records and may be incomplete.")}
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[440px] text-left text-xs sm:text-sm">
            <caption className="sr-only">
              {t("Outstanding business obligations and due dates")}
            </caption>
            <thead className="bg-muted text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
              <tr>
                <th scope="col" className="px-3 py-2.5">
                  {t("Type")}
                </th>
                <th scope="col" className="px-3 py-2.5">
                  {t("Reference")}
                </th>
                <th scope="col" className="px-3 py-2.5">
                  {t("Due date")}
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  {t("Amount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {obligations.map((item) => {
                const overdue = Boolean(item.due_date && item.due_date < asAt);
                return (
                  <tr
                    key={`${item.kind}-${item.reference_id}-${item.due_date}`}
                    className="border-t border-border align-top"
                  >
                    <td className="px-3 py-3 font-medium text-muted-foreground">
                      {t(kindName(item.kind))}
                    </td>
                    <td
                      className="max-w-28 truncate px-3 py-3 text-muted-foreground"
                      title={item.reference_id}
                    >
                      {item.reference_id}
                    </td>
                    <td
                      className={`px-3 py-3 ${overdue ? "font-medium text-rose-700" : "text-muted-foreground"}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {overdue && <AlertCircle size={13} aria-hidden="true" />}
                        {item.due_date ?? t("Due date unavailable")}
                        {overdue && " · Overdue"}
                      </span>
                      {overdue && (
                        <span className="mt-1 block text-[11px]" aria-hidden="true">
                          {t("Overdue")}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-foreground">
                      {formatMmk(item.amount_mmk)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
