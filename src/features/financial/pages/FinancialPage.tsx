import { useMemo, useState } from "react";
import { CalendarDays, Database, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
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
    <main className="space-y-6">
      <PageHeader
        eyebrow="Business overview"
        title="Financial Health"
        description={`Financial figures and recent trends for ${businessName}.`}
        action={
          <a className="bf-button-secondary inline-flex items-center gap-2" href="/data-source">
            <Database size={16} />
            Manage data
          </a>
        }
      >
        {synthetic && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-2.5 py-1 text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Synthetic demo data
          </span>
        )}
      </PageHeader>

      <section
        aria-label="Reporting period"
        className="bf-card flex flex-wrap items-end gap-3 sm:gap-4"
      >
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Reporting period
          <select
            aria-label="Reporting period"
            className="mt-1.5 block min-w-44 rounded-lg border bg-background px-3 py-2.5 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
          >
            <option value="month">Current month</option>
            <option value="30days">Last 30 days</option>
          </select>
        </label>
        <p className="inline-flex items-center gap-2 pb-2.5 text-sm text-muted-foreground">
          <CalendarDays size={16} />
          {period.start} – {period.end} · Yangon time
        </p>
        <button
          className="bf-button-secondary ml-auto inline-flex items-center gap-2"
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
        <p role="status" className="bf-card text-sm text-muted-foreground">
          Loading current financial records…
        </p>
      )}
      {state.status === "error" && !dataRefreshing && (
        <div
          role="alert"
          className="bf-card border-destructive/30 bg-destructive/10 text-sm text-destructive"
        >
          {state.error}{" "}
          <a className="ml-1 font-semibold underline" href="/data-source">
            Review data source
          </a>
        </div>
      )}
      {state.status === "ready" && !dataRefreshing && state.snapshot && (
        <>
          {state.snapshot.data_quality.warnings.length > 0 && (
            <aside
              aria-label="Financial data warnings"
              className="bf-card border-warning/50 bg-warning/10 text-sm"
            >
              <p className="font-semibold">Please note about this report</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {state.snapshot.data_quality.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </aside>
          )}
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
