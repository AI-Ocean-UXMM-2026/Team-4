import { useTranslation } from "@/lib/i18n";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { InventoryRiskTable } from "../components/InventoryRiskTable";
import { WorkingCapitalToolTabs } from "../components/WorkingCapitalToolTabs";
import { useWorkingCapital } from "../hooks/useWorkingCapital";
import { usePlatform } from "@/app/providers";
import { Link } from "@tanstack/react-router";
import { useWorkingCapitalManualInputs } from "../manualInputs";
import { applyManualInputs, needsWorkingCapitalInput } from "../applyManualInputs";
import { WorkingCapitalInputChoices } from "../components/WorkingCapitalInputChoices";

export function WorkingCapitalPage() {
  const { t } = useTranslation();

  const { business } = usePlatform();
  const { inputs: manualInputs } = useWorkingCapitalManualInputs();
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
  const display = snapshot ? applyManualInputs(snapshot, manualInputs) : null;
  const needsInput = needsWorkingCapitalInput(display);
  return (
    <main className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          {t("Working Capital")}
        </p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">
          {t("Plan cash with clearer choices")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {t(
            "Explore inventory, collections, cash timing, and reserves. Simulations are read-only and do not change your records.",
          )}
        </p>
      </header>
      <WorkingCapitalInputChoices
        inventory={snapshot?.inventory ?? []}
        recordedCashMmk={snapshot?.available_cash_mmk ?? null}
        complete={!needsInput}
      />
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
            {display?.inventory.length ?? 0} {t("products")}
          </span>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("Purchasing budget")}
          </p>
          <p className="mt-1 text-xl font-bold">
            {display?.purchasing_budget.budget_mmk == null
              ? t("Insufficient data")
              : t("{0} MMK", {
                  "0": Number(display.purchasing_budget.budget_mmk).toLocaleString("en-US"),
                })}
          </p>
          {display?.manualBudget && (
            <p className="mt-1 text-xs text-primary">
              {t("Source: Manual Entry")} ·{" "}
              {t(
                display.manualCash
                  ? "Cash and deductions are planning assumptions"
                  : "Deductions are planning assumptions",
              )}
            </p>
          )}
          {display?.purchasing_budget.budget_mmk == null && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                manualInputs
                  ? "Cash balance is unavailable. Enter available cash manually or complete expense payment details in Excel."
                  : "Required cash inputs are missing from workbook v1.",
              )}
            </p>
          )}
        </div>
        {snapshot?.as_of && (
          <p className="text-sm text-muted-foreground">
            {t("Sales window ends on the latest recorded sale: {0}.", { "0": snapshot.as_of })}
          </p>
        )}
        <InventoryRiskTable items={display?.inventory ?? []} />
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
          {t("Planning tools")}
        </p>
        <h2 className="mt-1 text-2xl font-bold">{t("Explore what could change")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "Unlock hidden cash uses imported amounts; sliders are what-if assumptions. Other scenario inputs may be illustrative.",
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "You can edit planning inputs above whenever a tool needs information your workbook does not contain.",
          )}
        </p>
      </div>
      <WorkingCapitalToolTabs
        key={`${business.id}:${business.source_version}`}
        unlockInputs={display?.unlock_cash}
        cashGapInputs={snapshot?.unlock_cash}
        manualStock={!!manualInputs && Object.keys(manualInputs.stockLevels).length > 0}
        manualInputs={manualInputs}
        simulate={simulate}
        planReserve={planReserve}
      />
    </main>
  );
}
