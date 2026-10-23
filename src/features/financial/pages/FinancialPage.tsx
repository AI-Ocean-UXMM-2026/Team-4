import { useTranslation } from "@/lib/i18n";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { NextStepCard } from "@/components/NextStepCard";
import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Database, RefreshCw, UploadCloud } from "lucide-react";
import { FinancialKpiCards } from "../components/FinancialKpiCards";
import { CashflowTrendChart } from "../components/CashflowTrendChart";
import { OutstandingBalances } from "../components/OutstandingBalances";
import { useFinancialSummary } from "../hooks/useFinancialSummary";
import type { FinancialClient, Period } from "../types";

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
  onSaveDueDate?: (purchaseId: string, dueDate: string, expectedDueDate: string | null) => Promise<void>;
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

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonthsClamped(date: Date, months: number) {
  const day = date.getUTCDate();
  const firstOfTarget = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0),
  ).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(day, lastDay));
  return firstOfTarget;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function periodForSelection(selection: string, today: string): Period {
  const end = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return { start: today, end: today };
  if (selection === "previous") {
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
    const previousEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0));
    return { start: isoDate(start), end: isoDate(previousEnd) };
  }
  if (selection === "year") return { start: `${today.slice(0, 4)}-01-01`, end: today };
  if (selection === "3months" || selection === "6months") {
    const months = selection === "3months" ? 3 : 6;
    return { start: isoDate(addMonthsClamped(end, -months)), end: today };
  }
  if (selection === "30days") return { start: isoDate(addDays(end, -29)), end: today };
  return { start: `${today.slice(0, 7)}-01`, end: today };
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
  onSaveDueDate,
  dataRefreshing = false,
}: FinancialPageProps) {
  const { t } = useTranslation();

  const [selection, setSelection] = useState("month");
  const [refresh, setRefresh] = useState(0);
  const period = useMemo(() => periodForSelection(selection, today), [selection, today]);
  const trendGranularity =
    selection === "3months" || selection === "6months" || selection === "year"
      ? "monthly"
      : "weekly";
  const state = useFinancialSummary(
    client,
    businessId,
    period,
    trendGranularity,
    importBatchId,
    refresh,
    sourceVersion,
  );
  const hasRecords = Boolean(importBatchId || sourceVersion);
  return (
    <div className="space-y-6">
      <header className="bf-page-hero flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            {businessName}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("Financial Health")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("A clear view of your money, so you can focus on your next move.")}
          </p>
          {synthetic && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {t("Synthetic demo data")}
            </span>
          )}
        </div>
        {hasRecords && (
          <a className="bf-button-secondary" href="/data-source">
            <Database size={16} />
            {t("Manage data")}
          </a>
        )}
      </header>

      {hasRecords && (
        <section
          aria-label={t("Reporting period")}
          className="bf-card flex flex-wrap items-end gap-3 p-4 sm:gap-4"
        >
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("Reporting period")}
            <select
              aria-label={t("Reporting period")}
              className="mt-1.5 block min-h-11 min-w-44 rounded-xl border bg-background px-3 py-2.5 text-sm font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              value={selection}
              onChange={(e) => setSelection(e.target.value)}
            >
              <option value="month">{t("Current month")}</option>
              <option value="30days">{t("Last 30 days")}</option>
              <option value="previous">{t("Previous month")}</option>
              <option value="3months">{t("Last 3 months")}</option>
              <option value="6months">{t("Last 6 months")}</option>
              <option value="year">{t("This year")}</option>
            </select>
          </label>
          <p className="inline-flex items-center gap-2 pb-2.5 text-sm text-muted-foreground">
            <CalendarDays size={16} />
            {period.start} – {period.end} {t("· Yangon time")}
          </p>
          <button
            className="bf-button-secondary ml-auto"
            onClick={() => {
              setRefresh((x) => x + 1);
              void onRefresh?.();
            }}
          >
            <RefreshCw size={15} />
            {t("Refresh")}
          </button>
        </section>
      )}

      {!hasRecords && (
        <section className="bf-empty-state" aria-labelledby="financial-start-heading">
          <span className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-primary">
            <UploadCloud size={29} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {t("A fresh start for your business")}
          </p>
          <h2
            id="financial-start-heading"
            className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {t("Start with your business data")}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
            {t(
              "Bring your sales, expenses, and payments together. Your first workbook turns this space into a picture of your business.",
            )}
          </p>
          <a href="/data-source" className="bf-button mt-6">
            {t("Set up my data")}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <ol className="mb-6 mt-8 grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
            {[
              { title: "Get your template", detail: "A simple workbook, ready for your business." },
              { title: "Add your records", detail: "Enter the numbers you already track." },
              {
                title: "See your insights",
                detail: "Upload once to bring your dashboard to life.",
              },
            ].map((step, index) => (
              <li key={t(step.title)} className="rounded-2xl bg-background p-4">
                <span className="mb-3 grid h-7 w-7 place-items-center rounded-lg bg-secondary text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <p className="text-sm font-semibold">{t(step.title)}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(step.detail)}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            {t("Start with a manual upload. Connect OneDrive whenever you’re ready.")}
          </p>
        </section>
      )}

      {hasRecords && (state.status === "loading" || dataRefreshing) && (
        <LoadingAnimation label="Loading current financial records…" />
      )}
      {hasRecords && state.status === "error" && !dataRefreshing && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900"
        >
          {t(state.error || "Something went wrong. Please try again.")}{" "}
          <a className="ml-1 font-semibold underline" href="/data-source">
            {t("Review data source")}
          </a>
        </div>
      )}
      {state.status === "ready" && !dataRefreshing && state.snapshot && (
        <>
          <FinancialKpiCards snapshot={state.snapshot} />
          <div className="flex min-w-0 flex-col gap-4">
            <div className="min-w-0 w-full">
              {state.trends && <CashflowTrendChart trends={state.trends} />}
            </div>
            <NextStepCard
              heading="Explore ways to improve your cash flow"
              description="Discover opportunities to collect customer payments, manage inventory, and prepare for cash shortages."
              action="Explore Working Capital"
              to="/working-capital"
              secondary={{ label: "Open Credit Hub", to: "/credit" }}
            />
            <div className="min-w-0 w-full">
              <OutstandingBalances
                obligations={state.snapshot.upcoming_obligations}
                asAt={period.end}
                cashAvailable={state.snapshot.actual.cash_balance_mmk}
                onSaveDueDate={onSaveDueDate ? async (purchaseId, dueDate, expectedDueDate) => {
                  await onSaveDueDate(purchaseId, dueDate, expectedDueDate);
                  setRefresh((value) => value + 1);
                } : undefined}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default FinancialPage;
