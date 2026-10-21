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
  const overdueCount = obligations.filter((item) => item.due_date && item.due_date < asAt).length;
  return (
    <section
      className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,.035)] sm:p-5"
      aria-label="Outstanding obligations"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-teal-700">
            Business obligations
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
            Outstanding payments
          </h2>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
          <CircleDollarSign size={18} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-1 text-sm leading-5 text-slate-500">
        Recorded balances through {asAt}. Due dates may be unavailable.
      </p>
      {overdueCount > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          <AlertCircle size={16} aria-hidden="true" />
          {overdueCount} {overdueCount === 1 ? "payment is" : "payments are"} past the recorded due
          date
        </p>
      )}
      {obligations.length === 0 ? (
        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-7 text-center">
          <CalendarClock size={22} className="mx-auto text-slate-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            No obligations in available records
          </p>
          <p className="mt-1 text-sm text-slate-500">
            This list reflects imported records and may be incomplete.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[440px] text-left text-xs sm:text-sm">
            <caption className="sr-only">Outstanding business obligations and due dates</caption>
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
              <tr>
                <th scope="col" className="px-3 py-2.5">
                  Type
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Reference
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Due date
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {obligations.map((item) => {
                const overdue = Boolean(item.due_date && item.due_date < asAt);
                return (
                  <tr
                    key={`${item.kind}-${item.reference_id}-${item.due_date}`}
                    className="border-t border-slate-100 align-top"
                  >
                    <td className="px-3 py-3 font-medium text-slate-700">{kindName(item.kind)}</td>
                    <td
                      className="max-w-28 truncate px-3 py-3 text-slate-600"
                      title={item.reference_id}
                    >
                      {item.reference_id}
                    </td>
                    <td
                      className={`px-3 py-3 ${overdue ? "font-medium text-rose-700" : "text-slate-500"}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {overdue && <AlertCircle size={13} aria-hidden="true" />}
                        {item.due_date ?? "Unavailable"}
                      </span>
                      {overdue && <span className="mt-1 block text-[11px]">Overdue</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-950">
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
