import { CashGapSimulator } from "../components/CashGapSimulator";
import { InventoryRiskTable } from "../components/InventoryRiskTable";
import { ReservePlanner } from "../components/ReservePlanner";
import { UnlockCashSimulator } from "../components/UnlockCashSimulator";
import { useWorkingCapital } from "../hooks/useWorkingCapital";
import { usePlatform } from "@/app/providers";

export function WorkingCapitalPage() {
  const { business } = usePlatform();
  const { snapshot, error, loading, simulate, planReserve } = useWorkingCapital(
    business.id,
    business.source_version,
  );
  if (loading) return <p>Loading working-capital snapshot…</p>;
  if (error) return <p role="alert">{error}</p>;
  return (
    <main>
      <header>
        <h1>Smart Working Capital Management</h1>
        <p>Simulation only; your records have not changed.</p>
        {snapshot?.warnings.map((warning) => (
          <p key={warning}>
            <small>{warning}</small>
          </p>
        ))}
      </header>
      <section>
        <h2>Inventory & purchasing planner</h2>
        <p>Purchasing budget: {snapshot?.purchasing_budget.budget_mmk ?? "Insufficient data"}</p>
        <InventoryRiskTable items={snapshot?.inventory ?? []} />
      </section>
      <UnlockCashSimulator simulate={simulate} />
      <CashGapSimulator simulate={simulate} />
      <ReservePlanner planReserve={planReserve} />
    </main>
  );
}
