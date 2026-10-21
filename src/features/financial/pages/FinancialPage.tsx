import { useMemo, useState } from "react";
import { CalendarDays, Database, RefreshCw } from "lucide-react";
import { FinancialKpiCards } from "../components/FinancialKpiCards";
import { CashflowTrendChart } from "../components/CashflowTrendChart";
import { OutstandingBalances } from "../components/OutstandingBalances";
import { useFinancialSummary } from "../hooks/useFinancialSummary";
import type { FinancialClient } from "../types";

export interface FinancialPageProps {
  client: FinancialClient;
  businessId: string;
  businessName: string;
  /** Update after every successful import to invalidate old cards. */
  importBatchId: string | null;
  synthetic: boolean;
  /** Optional deterministic clock for demos and tests. */
  today?: string;
  sourceVersion?: number;
  onRefresh?: () => Promise<void>;
  dataRefreshing?: boolean;
}

function yangonToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Yangon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function FinancialPage({
  client,
  businessId,
  businessName,
  importBatchId,
  synthetic,
  today = yangonToday(),
  sourceVersion,
  onRefresh,
  dataRefreshing = false,
}: FinancialPageProps) {
  const [selection, setSelection] = useState("month");
  const [refresh, setRefresh] = useState(0);
  const period = useMemo(() => {
    if (selection === "month") return { start: `${today.slice(0, 7)}-01`, end: today };
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 29);
    return { start: date.toISOString().slice(0, 10), end: today };
  }, [selection, today]);
  const state = useFinancialSummary(
    client,
    businessId,
    period,
    importBatchId,
    refresh,
    sourceVersion,
  );
  return (
    <main className="mx-auto max-w-[1440px] space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,.035)] sm:p-5">
        <div>
          <p className="text-sm font-medium text-slate-500">{businessName}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Financial Health
          </h1>
          {synthetic && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Preview data
            </span>
          )}
        </div>
        <a
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          href="/data-source"
        >
          <Database size={16} />
          Manage data
        </a>
      </header>

      <section
        aria-label="Reporting period"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,.025)] sm:gap-4 sm:p-4"
      >
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Reporting period
          <select
            aria-label="Reporting period"
            className="mt-1.5 block min-w-44 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
          >
            <option value="month">Current month</option>
            <option value="30days">Last 30 days</option>
          </select>
        </label>
        <p className="inline-flex items-center gap-2 pb-2.5 text-sm text-slate-500">
          <CalendarDays size={16} />
          {period.start} – {period.end} · Yangon time
        </p>
        <button
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          onClick={() => {
            setRefresh((x) => x + 1);
            void onRefresh?.();
          }}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </section>

      {(state.status === "loading" || dataRefreshing) && (
        <p
          role="status"
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
        >
          Loading current financial records…
        </p>
      )}
      {state.status === "error" && !dataRefreshing && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900"
        >
          {state.error}{" "}
          <a className="ml-1 font-semibold underline" href="/data-source">
            Review data source
          </a>
        </div>
      )}
      {state.status === "ready" && !dataRefreshing && state.snapshot && (
        <>
          <FinancialKpiCards snapshot={state.snapshot} />
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-5">
            <div className="min-w-0 xl:col-span-3">
              {state.trends && <CashflowTrendChart trends={state.trends} />}
            </div>
            <div className="min-w-0 xl:col-span-2">
              <OutstandingBalances
                obligations={state.snapshot.upcoming_obligations}
                asAt={period.end}
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export default FinancialPage;
