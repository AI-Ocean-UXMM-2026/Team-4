import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  Info,
  Package,
  Sparkles,
} from "lucide-react";
import { useBusinessAnalysis } from "./useBusinessAnalysis";
import type { Insight } from "./types";

const labels: Record<Insight["category"], string> = {
  liquidity: "Cash flow",
  working_capital: "Working capital",
  credit: "Credit",
  data_quality: "Data quality",
};

const categoryIcons: Record<Insight["category"], typeof CircleDollarSign> = {
  liquidity: CircleDollarSign,
  working_capital: Package,
  credit: ClipboardCheck,
  data_quality: Database,
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
  { to: "/" | "/working-capital" | "/credit" | "/data-source"; label: string }
> = {
  "supplier-shortfall": { to: "/", label: "Open Financial Health" },
  "receivables-followup": { to: "/", label: "Open Financial Health" },
  "supplier-balances": { to: "/working-capital", label: "Open Working Capital" },
  "slow-stock-review": { to: "/working-capital", label: "Open Working Capital" },
  "stockout-review": { to: "/working-capital", label: "Open Working Capital" },
  "repayment-review": { to: "/credit", label: "Open Credit Hub" },
  "loan-terms-review": { to: "/credit", label: "Open Credit Hub" },
  "data-quality": { to: "/data-source", label: "Open Data Source" },
};

const issueDescriptions: Record<string, string> = {
  "supplier-shortfall":
    "Recorded cash balance is insufficient to cover supplier payments maturing within the next 30 days, creating a liquidity deficit.",
  "receivables-followup":
    "The financial snapshot records uncollected customer balances that represent trapped working capital.",
  "supplier-balances":
    "The financial snapshot records unpaid purchase balances that need scheduled settlement.",
  "slow-stock-review":
    "Stock on hand has recorded zero sales over the observed 30-day window, tying up cash in slow-moving inventory.",
  "stockout-review":
    "Inventory coverage for certain products has dropped below supplier lead times, risking empty shelves.",
  "repayment-review":
    "Scheduled debt service obligations exceed your currently available repayment cash.",
  "loan-terms-review":
    "Recorded loan principal is outstanding, but the system lacks rate and tenure terms for repayment planning.",
  "data-quality":
    "Some source workbook data is missing or incomplete, which may limit recommendation accuracy.",
};

const recommendedActions: Record<string, string[]> = {
  "supplier-shortfall": [
    "Open Financial Health to inspect cash balance trends and upcoming obligation dates.",
    "Contact primary suppliers to negotiate a staggered settlement plan or 14-day payment extension.",
    "Pause non-essential purchase orders until cash reserves recover.",
  ],
  "receivables-followup": [
    "Open Financial Health to inspect customer balance details and identify aging accounts.",
    "Contact customers with overdue invoices and confirm firm payment commitment dates.",
    "Offer a small early-settlement incentive to accelerate cash collection before supplier bills mature.",
  ],
  "supplier-balances": [
    "Open Working Capital to review unpaid supplier balances and cash gap timing.",
    "Align supplier payment dates with expected customer collection days.",
    "Request 30-day payment terms from top suppliers to reduce cash strain.",
  ],
  "slow-stock-review": [
    "Open Working Capital to inspect inventory items with zero sales in the last 30 days.",
    "Run a clearance promotion or bundle slow items with popular products to unlock cash.",
    "Halt replenishment orders for these SKUs until current inventory is cleared.",
  ],
  "stockout-review": [
    "Open Working Capital to identify products with inventory coverage below supplier lead times.",
    "Place replenishment orders immediately for essential fast-selling items.",
    "Verify supplier lead times to ensure future orders are placed on schedule.",
  ],
  "repayment-review": [
    "Open Credit Hub to review scheduled loan instalments against available repayment cash.",
    "Engage with your lender early to discuss grace periods or restructured instalment timing.",
    "Ring-fence debt service funds in a separate account to avoid operational deficit.",
  ],
  "loan-terms-review": [
    "Open Credit Hub to view loans missing interest rates and tenure terms.",
    "Consult your loan agreement and enter interest rates and tenure for accurate schedule projection.",
  ],
  "data-quality": [
    "Open Data Source to review import warnings and resolve missing sheet records.",
    "Re-upload your verified Excel workbook so all financial metrics reflect complete records.",
  ],
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

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const destination = nextStepDestinations[insight.id] ?? {
    to: destinations[insight.category],
    label: "View supporting metrics",
  };

  const issueDesc = issueDescriptions[insight.id] || insight.explanation;
  const recommendedList = recommendedActions[insight.id];
  const actions =
    recommendedList && recommendedList.length > 0
      ? recommendedList
      : insight.suggested_actions;
  const CategoryIcon = categoryIcons[insight.category] ?? CircleDollarSign;

  const isHighPriority = insight.priority === "high";

  return (
    <li
      className={`bf-card space-y-4 rounded-2xl border transition-all hover:shadow-md ${
        isHighPriority ? "border-l-4 border-l-red-500" : "border-l-4 border-l-amber-500"
      }`}
    >
      {/* Header with Badges and Direct Action Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border/40 pb-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">
              <CategoryIcon size={13} />
              {t(labels[insight.category])}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isHighPriority
                  ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
              }`}
            >
              {index + 1}. {t(insight.priority)} {t("priority")}
            </span>
          </div>
          <h3 className="text-xl font-bold tracking-tight text-foreground">{t(insight.title)}</h3>
        </div>

        {/* Primary Page Deep-Link Button */}
        <Link
          to={destination.to}
          className="bf-button inline-flex items-center justify-center gap-2 shrink-0 text-center font-semibold text-sm shadow-sm hover:opacity-90 active:scale-[0.99] transition"
        >
          <span>{t(destination.label)}</span>
          <ArrowRight size={15} />
        </Link>
      </div>

      {/* The Issue Box */}
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-destructive">
          <AlertTriangle size={15} />
          {t("The Issue")}
        </p>
        <p className="mt-1.5 text-sm font-medium leading-relaxed text-foreground">
          {t(issueDesc)}
        </p>
      </div>

      {/* How to Fix Box */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
          <CheckCircle2 size={15} />
          {t("How to Fix")}
        </p>
        <div className="mt-2.5 space-y-2 text-sm">
          {actions.map((action, actionIndex) => (
            <div key={actionIndex} className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                {actionIndex + 1}
              </span>
              <span className="leading-snug text-foreground/90">{t(action)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* View Details & Evidence Section */}
      <div className="border-t border-border/50 pt-2">
        <button
          type="button"
          onClick={() => setDetailsOpen(!detailsOpen)}
          className="flex w-full items-center justify-between py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-1.5">
            <Info size={14} />
            {detailsOpen
              ? t("Hide Details")
              : `${t("View Details & Evidence")} (${insight.evidence.length} ${t("metrics")})`}
          </span>
          {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {detailsOpen && (
          <div className="mt-3 rounded-xl bg-muted/40 p-4 text-xs space-y-3 animate-in fade-in duration-200">
            <div>
              <p className="font-semibold text-foreground/80 uppercase tracking-wider text-[11px]">
                {t("Supporting evidence")}
              </p>
              <ul className="mt-2 space-y-1.5">
                {insight.evidence.map((item) => (
                  <li
                    key={item.metric}
                    className="flex justify-between items-center py-1 border-b border-border/30 last:border-0"
                  >
                    <span className="text-muted-foreground">
                      {t(metricLabels[item.metric] ?? item.metric)}
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {formatValue(item.metric, item.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {insight.assumptions.length > 0 && (
              <div className="border-t border-border/40 pt-2 text-muted-foreground">
                <span className="font-semibold text-foreground/70">{t("Assumptions:")} </span>
                {insight.assumptions.map((assumption) => t(assumption)).join(" ")}
              </div>
            )}

            <div className="border-t border-border/40 pt-2 flex justify-end">
              <Link
                to={destination.to}
                className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
              >
                {t(destination.label)} →
              </Link>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function NextSteps({ insights }: { insights: Insight[] }) {
  const { t } = useTranslation();

  if (insights.length === 0) return null;

  return (
    <section aria-labelledby="ai-next-steps" className="space-y-4">
      <div className="bf-card">
        <h2 id="ai-next-steps" className="text-2xl font-bold">
          {t("What to do next")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "Review detected business issues, actionable remediation steps, and open direct hub tools for deeper inspection.",
          )}
        </p>
      </div>
      <ol className="space-y-4">
        {insights.map((insight, index) => (
          <InsightCard key={insight.id} insight={insight} index={index} />
        ))}
      </ol>
    </section>
  );
}

export function AIAnalyzerPage() {
  const { t } = useTranslation();

  const { business, report, isOutdated, isLoading, error, isAnalyzing, run } =
    useBusinessAnalysis();
  return (
    <main className="space-y-6">
      <header className="bf-card space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles size={14} />
          {t("Business insights")}
        </div>
        <h1 className="text-3xl font-bold">{t("AI Business Analyzer")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Review evidence-backed findings from your financial, working capital, and credit snapshots.",
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("Current import version:")} {business.source_version}
        </p>
        <button className="bf-button inline-flex items-center gap-2" onClick={() => run(true)} disabled={isAnalyzing}>
          <Sparkles size={15} />
          {isAnalyzing ? t("Analyzing…") : t("Analyze with AI")}
        </button>
        <p className="max-w-2xl text-xs text-muted-foreground">
          {t(
            "By selecting Analyze with AI, you agree to send summary financial amounts and findings from this import to the configured external AI provider. The workbook, names, and individual transaction rows are not sent.",
          )}
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
        <section className="bf-card text-center py-10 space-y-3">
          <p className="font-semibold text-foreground">{t("No analysis yet. Import business records, then select Analyze with AI.")}</p>
          <Link to="/data-source" className="bf-button inline-block">
            {t("Open Data Source")}
          </Link>
        </section>
      )}
      {report && (
        <>
          {isOutdated && (
            <p role="status" className="bf-card border border-destructive text-destructive">
              {t(
                "This report uses an older import. Select Analyze with AI again for the current version.",
              )}
            </p>
          )}
          <section className="bf-card space-y-2 text-sm">
            <p className="font-semibold">
              {report.status === "completed"
                ? t("AI-assisted analysis")
                : report.status === "rules_only"
                  ? t("AI was not used — verified findings shown")
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
          <NextSteps insights={report.insights} />
          <p className="text-xs text-muted-foreground">{report.disclaimer}</p>
        </>
      )}
    </main>
  );
}
