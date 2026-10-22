import { useTranslation } from "@/lib/i18n";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { Link } from "@tanstack/react-router";
import { useBusinessAnalysis } from "./useBusinessAnalysis";
import type { Insight } from "./types";

const labels: Record<Insight["category"], string> = {
  liquidity: "Cash flow",
  working_capital: "Working capital",
  credit: "Credit",
  data_quality: "Data quality",
};
const destinations: Record<
  Insight["category"],
  "/" | "/working-capital" | "/credit" | "/data-source"
> = {
  liquidity: "/",
  working_capital: "/working-capital",
  credit: "/credit",
  data_quality: "/data-source",
};
const nextStepDestinations: Record<
  string,
  { to: "/working-capital" | "/credit" | "/data-source"; label: string }
> = {
  "supplier-shortfall": { to: "/data-source", label: "Open Data Source" },
  "receivables-followup": { to: "/data-source", label: "Open Data Source" },
  "supplier-balances": { to: "/data-source", label: "Open Data Source" },
  "slow-stock-review": { to: "/working-capital", label: "Open Working Capital" },
  "stockout-review": { to: "/working-capital", label: "Open Working Capital" },
  "repayment-review": { to: "/credit", label: "Open Credit Hub" },
  "loan-terms-review": { to: "/credit", label: "Open Credit Hub" },
  "data-quality": { to: "/data-source", label: "Open Data Source" },
};
const metricLabels: Record<string, string> = {
  cash_balance_mmk: "Recorded cash",
  supplier_due_30d_mmk: "Dated supplier payments within a month",
  receivables_mmk: "Receivables",
  payables_mmk: "Payables",
  stockout_review_count: "Products to review",
  ccc_days: "Cash conversion cycle days",
  loan_count: "Recorded loans",
  repayment_available_cash_mmk: "Cash available for repayment",
  repayment_due_mmk: "Upcoming repayment",
  repayment_difference_mmk: "Repayment cash difference",
  slow_moving_stock_count: "Stock items with no recent sales",
  outstanding_principal_mmk: "Outstanding loan principal",
  missing_schedule_terms_count: "Loans without schedule terms",
};

function formatValue(metric: string, value: string) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const fraction = match[3]?.replace(/0+$/, "");
  const text = `${match[1]}${match[2]!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction}` : ""}`;
  return metric.endsWith("_mmk") ? `${text} MMK` : text;
}

function NextSteps({ insights }: { insights: Insight[] }) {
  const { t } = useTranslation();

  if (insights.length === 0) return null;

  return (
    <section aria-labelledby="ai-next-steps" className="bf-card space-y-4">
      <div>
        <h2 id="ai-next-steps" className="text-2xl font-bold">
          {t("What to do next")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "Start with these actions, then check the evidence below. Verify source records before making a decision.",
          )}
        </p>
      </div>
      <ol className="space-y-3">
        {insights.map((insight, index) => {
          const destination = nextStepDestinations[insight.id] ?? {
            to: destinations[insight.category],
            label: "View supporting metrics",
          };
          return (
            <li key={insight.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {index + 1}. {t(insight.priority)} {t("priority")} ·{" "}
                    {t(labels[insight.category])}
                  </p>
                  <h3 className="font-semibold">{t(insight.title)}</h3>
                  {insight.suggested_actions.map((action, actionIndex) => (
                    <p key={actionIndex} className="text-sm">
                      {t(action)}
                    </p>
                  ))}
                </div>
                <Link to={destination.to} className="bf-button shrink-0 text-center">
                  {t(destination.label)}
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const { t } = useTranslation();

  return (
    <article className="bf-card space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <span className="text-primary">{t(labels[insight.category])}</span>
        <span className="rounded-full bg-secondary px-2 py-1">
          {t(insight.priority)} {t("priority")}
        </span>
      </div>
      <h2 className="text-xl font-bold">{t(insight.title)}</h2>
      <p>{t(insight.explanation)}</p>
      <div>
        <h3 className="text-sm font-semibold">{t("Supporting evidence")}</h3>
        <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
          {insight.evidence.map((item) => (
            <li key={item.metric}>
              {t(metricLabels[item.metric] ?? item.metric)}: {formatValue(item.metric, item.value)}
            </li>
          ))}
        </ul>
      </div>
      {insight.assumptions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("Assumptions:")} {insight.assumptions.map((assumption) => t(assumption)).join(" ")}
        </p>
      )}
      <Link
        to={destinations[insight.category]}
        className="text-sm font-semibold text-primary underline"
      >
        {t("View supporting metrics")}
      </Link>
    </article>
  );
}

export function AIAnalyzerPage() {
  const { t } = useTranslation();

  const { business, report, isOutdated, isLoading, error, isAnalyzing, run } =
    useBusinessAnalysis();
  return (
    <main className="space-y-6">
      <header className="bf-card space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          {t("Business insights")}
        </p>
        <h1 className="text-3xl font-bold">{t("AI Business Analyzer")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Review evidence-backed findings from your financial, working capital, and credit snapshots.",
          )}
        </p>
        <button className="bf-button" onClick={run} disabled={isAnalyzing}>
          {isAnalyzing ? t("Analyzing…") : t("Analyze Business")}
        </button>
        <p className="text-xs text-muted-foreground">
          {t("Current import version:")} {business.source_version}
        </p>
      </header>
      {(isLoading || isAnalyzing) && (
        <LoadingAnimation label={isAnalyzing ? "Analyzing…" : "Loading your latest analysis…"} />
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {t(error.message)}
        </p>
      )}
      {!isLoading && !report && (
        <section className="bf-card">
          <p>{t("No analysis yet. Import business records, then select Analyze Business.")}</p>
          <Link to="/data-source" className="mt-3 inline-block text-primary underline">
            {t("Open Data Source")}
          </Link>
        </section>
      )}
      {report && (
        <>
          {isOutdated && (
            <p role="status" className="bf-card border border-destructive text-destructive">
              {t(
                "This report uses an older import. Analyze Business again for the current version.",
              )}
            </p>
          )}
          <NextSteps insights={report.insights} />
          <section className="bf-card space-y-2 text-sm">
            <p className="font-semibold">
              {report.status === "completed"
                ? t("AI-assisted analysis")
                : report.status === "rules_only"
                  ? t("Rules-based analysis (AI unavailable)")
                  : t("Insufficient data for analysis")}
            </p>
            <p>
              {t("Generated:")} {new Date(report.generated_at).toLocaleString()}{" "}
              {t("· Import version")} {report.source_version}
            </p>
            {report.data_as_of && (
              <p>
                {t("Source as of:")} {new Date(report.data_as_of).toLocaleString()}
              </p>
            )}
            {report.warnings.map((warning, index) => (
              <p key={index} className="text-muted-foreground">
                {t(warning)}
              </p>
            ))}
            {report.status === "insufficient_data" && (
              <Link to="/data-source" className="text-primary underline">
                {t("Upload or sync business records to analyze")}
              </Link>
            )}
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            {report.insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{report.disclaimer}</p>
        </>
      )}
    </main>
  );
}
