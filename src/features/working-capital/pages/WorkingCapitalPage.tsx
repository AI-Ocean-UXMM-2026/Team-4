import { CashGapSimulator } from "../components/CashGapSimulator";
import { InventoryRiskTable } from "../components/InventoryRiskTable";
import { ReservePlanner } from "../components/ReservePlanner";
import { UnlockCashSimulator } from "../components/UnlockCashSimulator";
import { useWorkingCapital } from "../hooks/useWorkingCapital";
import { usePlatform } from "@/app/providers";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";

export function WorkingCapitalPage() {
  const { business } = usePlatform();
  const { snapshot, error, loading, simulate, planReserve } = useWorkingCapital(
    business.id,
    business.source_version,
  );
  if (loading)
    return (
      <p role="status" className="bf-card text-muted-foreground">
        Loading working-capital snapshot…
      </p>
    );
  if (error)
    return (
      <p role="alert" className="bf-card text-destructive">
        {error}
      </p>
    );
  return (
    <main className="space-y-6">
      <PageHeader
        eyebrow="Working Capital"
        title="Plan cash with clearer choices"
        description="Explore inventory, collections, cash timing, and reserves. Simulations are read-only and do not change your records."
      />
      {snapshot?.warnings.length ? (
        <section className="bf-card border-warning/50 bg-warning/10" aria-label="Data limitations">
          <h2 className="text-sm font-semibold">Information still needed</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {snapshot.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="bf-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              Your imported records
            </p>
            <h2 className="mt-1 text-xl font-bold">Inventory & purchasing</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review stock and recent sales before planning a purchase.
            </p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            {snapshot?.inventory.length ?? 0} products
          </span>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Purchasing budget
          </p>
          <p className="mt-1 text-xl font-bold">
            {snapshot?.purchasing_budget.budget_mmk == null
              ? "Insufficient data"
              : `${Number(snapshot.purchasing_budget.budget_mmk).toLocaleString("en-US")} MMK`}
          </p>
          {snapshot?.purchasing_budget.budget_mmk == null && (
            <p className="mt-1 text-sm text-muted-foreground">
              Required cash inputs are missing from workbook v1.
            </p>
          )}
        </div>
        <InventoryRiskTable items={snapshot?.inventory ?? []} />
        {!snapshot?.inventory.length && (
          <Link
            to="/data-source"
            className="inline-block text-sm font-semibold text-primary underline"
          >
            Open Data Source
          </Link>
        )}
      </section>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">
          Illustrative scenarios
        </p>
        <h2 className="mt-1 text-2xl font-bold">Explore what could change</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Example inputs below are not your imported business figures.
        </p>
      </div>
      <UnlockCashSimulator simulate={simulate} />
      <CashGapSimulator simulate={simulate} />
      <ReservePlanner planReserve={planReserve} />
    </main>
  );
}
