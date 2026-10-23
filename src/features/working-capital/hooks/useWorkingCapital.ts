import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";

export type DecimalString = string | number;
export type InventoryRisk = {
  product_id: string;
  name: string;
  current_stock_qty: DecimalString;
  unit_cost_mmk?: DecimalString | null;
  average_units_sold_per_day_7: DecimalString | null;
  average_units_sold_per_day_30: DecimalString | null;
  coverage_days: DecimalString | null;
  supplier_lead_days?: number | null;
  risk_threshold_days?: DecimalString | null;
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
  available_cash_mmk: DecimalString | null;
  unlock_cash: {
    as_of: string | null;
    stock_value_mmk: DecimalString | null;
    receivables_mmk: DecimalString | null;
    expense_candidates: {
      expense_id: string;
      category: string;
      description: string | null;
      amount_mmk: DecimalString;
    }[];
    average_weekly_running_cost_mmk: DecimalString | null;
  };
  warnings: string[];
};

export function useWorkingCapital(businessId: string, sourceVersion: number, safetyBufferDays = 3) {
  const query = useQuery({
    queryKey: ["working-capital", businessId, sourceVersion, safetyBufferDays],
    enabled: !!businessId,
    queryFn: () =>
      api<WorkingCapitalSnapshot>(
        `/api/v1/working-capital/summary?business_id=${encodeURIComponent(businessId)}&safety_buffer_days=${safetyBufferDays}`,
      ),
  });
  const simulate = <T>(scenario_type: string, assumptions: Record<string, unknown>) =>
    api<T>(`/api/v1/working-capital/simulate?business_id=${encodeURIComponent(businessId)}`, {
      method: "POST",
      body: JSON.stringify({ scenario_type, assumptions }),
    });
  const planReserve = <T>(payload: Record<string, unknown>) =>
    api<T>(`/api/v1/working-capital/reserve-plan?business_id=${encodeURIComponent(businessId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  return {
    snapshot: query.data ?? null,
    error: query.error?.message ?? null,
    loading: query.isPending,
    refresh: query.refetch,
    simulate,
    planReserve,
  };
}
