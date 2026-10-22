import { useTranslation } from "@/lib/i18n";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { CashGapSimulator } from "../components/CashGapSimulator";
import { InventoryRiskTable } from "../components/InventoryRiskTable";
import { ReservePlanner } from "../components/ReservePlanner";
import { UnlockCashSimulator } from "../components/UnlockCashSimulator";
import { useWorkingCapital } from "../hooks/useWorkingCapital";
import { usePlatform } from "@/app/providers";
import { Link } from "@tanstack/react-router";

export function WorkingCapitalPage() {
  const { t } = useTranslation();

  const { business } = usePlatform();
  const { snapshot, error, loading, simulate, planReserve } = useWorkingCapital(
    business.id,
    business.source_version,
  );
  if (loading) return <LoadingAnimation label="Loading working-capital snapshot…" />;
  if (error)
    return (
      <p role="alert" className="bf-card text-destructive">
        {t(error)}
      </p>
    );
  return (
    <main className="space-y-6">
      <header className="bf-brand-banner rounded-3xl px-6 py-8 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em]">{t("Working Capital")}</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">
          {t("Plan cash with clearer choices")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--feature-muted)] sm:text-base">
          {t(
            "Explore inventory, collections, cash timing, and reserves. Simulations are read-only and do not change your records.",
          )}
        </p>
      </header>
      {snapshot?.warnings.length ? (
        <section
          className="bf-card border-warning/50 bg-warning/10"
          aria-label={t("Data limitations")}
        >
          <h2 className="text-sm font-semibold">{t("Information still needed")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {snapshot.warnings.map((warning) => (
              <li key={warning}>{t(warning)}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="bf-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              {t("Your imported records")}
            </p>
            <h2 className="mt-1 text-xl font-bold">{t("Inventory & purchasing")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Review stock and recent sales before planning a purchase.")}
            </p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            {snapshot?.inventory.length ?? 0} {t("products")}
          </span>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("Purchasing budget")}
          </p>
          <p className="mt-1 text-xl font-bold">
            {snapshot?.purchasing_budget.budget_mmk == null
              ? t("Insufficient data")
              : t("{0} MMK", {
                  "0": Number(snapshot.purchasing_budget.budget_mmk).toLocaleString("en-US"),
                })}
          </p>
          {snapshot?.purchasing_budget.budget_mmk == null && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Required cash inputs are missing from workbook v1.")}
            </p>
          )}
        </div>
        <InventoryRiskTable items={snapshot?.inventory ?? []} />
        {!snapshot?.inventory.length && (
          <Link
            to="/data-source"
            className="inline-block text-sm font-semibold text-primary underline"
          >
            {t("Open Data Source")}
          </Link>
        )}
      </section>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          {t("Illustrative scenarios")}
        </p>
        <h2 className="mt-1 text-2xl font-bold">{t("Explore what could change")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "Unlock hidden cash uses imported amounts; sliders are what-if assumptions. Other scenario inputs may be illustrative.",
          )}
        </p>
      </div>
      <UnlockCashSimulator
        key={`${business.id}:${business.source_version}`}
        inputs={snapshot?.unlock_cash}
      />
      <CashGapSimulator
        key={`${business.id}:${business.source_version}`}
        simulate={simulate}
        inputs={snapshot?.unlock_cash}
      />
      <ReservePlanner planReserve={planReserve} />
    </main>
  );
}
