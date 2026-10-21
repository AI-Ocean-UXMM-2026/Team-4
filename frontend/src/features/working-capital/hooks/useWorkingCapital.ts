import { useCallback, useEffect, useState } from "react";
import { api } from "../../../../../src/lib/apiClient";

export type DecimalString = string | number;
export type InventoryRisk = {
  product_id: string;
  name: string;
  current_stock_qty: DecimalString;
  average_units_sold_per_day_7: DecimalString | null;
  average_units_sold_per_day_30: DecimalString | null;
  coverage_days: DecimalString | null;
  stockout_risk: boolean | null;
  status: "observed" | "insufficient_data" | "no_recent_sales";
  slow_moving: boolean;
  slow_moving_rule: string;
};

export type WorkingCapitalSnapshot = {
  business_id: string;
  as_of: string | null;
  source_version: number | null;
  inventory: InventoryRisk[];
  purchasing_budget: { status: string; budget_mmk: DecimalString | null };
  warnings: string[];
};

export function useWorkingCapital(businessId: string, safetyBufferDays = 3) {
  const [snapshot, setSnapshot] = useState<WorkingCapitalSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      setSnapshot(await api<WorkingCapitalSnapshot>(`/api/v1/working-capital/summary?business_id=${encodeURIComponent(businessId)}&safety_buffer_days=${safetyBufferDays}`));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load working-capital data.");
    } finally {
      setLoading(false);
    }
  }, [businessId, safetyBufferDays]);
  useEffect(() => { void refresh(); }, [refresh]);
  const simulate = <T,>(scenario_type: string, assumptions: Record<string, unknown>) =>
    api<T>("/api/v1/working-capital/simulate", { method: "POST", body: JSON.stringify({ scenario_type, assumptions }) });
  const planReserve = <T,>(payload: Record<string, unknown>) =>
    api<T>("/api/v1/working-capital/reserve-plan", { method: "POST", body: JSON.stringify(payload) });
  return { snapshot, error, loading, refresh, simulate, planReserve };
}
