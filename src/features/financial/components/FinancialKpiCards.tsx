import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  CreditCard,
  ReceiptText,
  Wallet,
} from "lucide-react";
import type { FinancialSnapshot, Money } from "../types";
import { formatMmk } from "../types";

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "neutral",
  prominent = false,
}: {
  label: string;
  value: Money;
  note: string;
  icon: typeof Wallet;
  tone?: "positive" | "warning" | "negative" | "neutral";
  prominent?: boolean;
}) {
  const palette = {
    positive: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    warning: "bg-amber-50 text-amber-700 ring-amber-100",
    negative: "bg-rose-50 text-rose-700 ring-rose-100",
    neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  }[tone];
  return (
    <article
      className={`rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,.035)] sm:p-5 ${prominent ? "min-h-36" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${palette}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      <p
        className={`mt-4 break-words font-semibold tracking-tight text-slate-950 ${prominent ? "text-2xl sm:text-[1.7rem]" : "text-xl"}`}
      >
        {formatMmk(value)}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-slate-500">{note}</p>
    </article>
  );
}

export function FinancialKpiCards({ snapshot }: { snapshot: FinancialSnapshot }) {
  const a = snapshot.actual;
  const cashTone =
    a.cash_balance_mmk === null
      ? "neutral"
      : Number(a.cash_balance_mmk) < 0
        ? "negative"
        : "positive";
  return (
    <section aria-label="Financial summary" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-teal-700">
            At a glance
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
            Key financial figures
          </h2>
        </div>
        <span className="hidden text-xs text-slate-500 sm:inline">
          Selected period and latest recorded balances
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Cash available"
          value={a.cash_balance_mmk}
          note="Recorded balance through period end"
          icon={Wallet}
          tone={cashTone}
          prominent
        />
        <MetricCard
          label="Revenue"
          value={a.revenue_mmk}
          note="Sales recorded in this period"
          icon={ArrowUpRight}
          tone="positive"
          prominent
        />
        <MetricCard
          label="Operating expenses"
          value={a.operating_expenses_mmk}
          note="Operating costs recorded this period"
          icon={ArrowDownRight}
          tone="warning"
          prominent
        />
        <MetricCard
          label="Customer receivables"
          value={a.receivables_mmk}
          note="Money customers still owe"
          icon={CircleDollarSign}
          tone="neutral"
          prominent
        />
      </div>
      <details className="group rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_4px_18px_rgba(15,23,42,.025)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-700">
          <span>More financial figures</span>
          <span className="text-xs text-slate-500 group-open:hidden">Show details</span>
          <span className="hidden text-xs text-slate-500 group-open:inline">Hide details</span>
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Cost of goods sold"
            value={a.cogs_mmk}
            note="Unavailable if historical sale costs were not imported"
            icon={ReceiptText}
          />
          <MetricCard
            label="Operating profit"
            value={a.operating_profit_mmk}
            note="Revenue less operating costs, when available"
            icon={ArrowUpRight}
            tone={
              a.operating_profit_mmk !== null && Number(a.operating_profit_mmk) < 0
                ? "negative"
                : "neutral"
            }
          />
          <MetricCard
            label="Cash-paid interest"
            value={a.interest_expenses_mmk}
            note="Interest paid during the selected period"
            icon={CreditCard}
            tone="warning"
          />
          <MetricCard
            label="Supplier balances"
            value={a.payables_mmk}
            note="Recorded amount owed to suppliers"
            icon={Banknote}
            tone="warning"
          />
        </div>
      </details>
    </section>
  );
}
