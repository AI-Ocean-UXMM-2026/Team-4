type RangeFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
};

export function RangeField({ label, value, min, max, step, unit = "", onChange }: RangeFieldProps) {
  return (
    <label className="block space-y-3 rounded-xl border bg-background p-4">
      <span className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="whitespace-nowrap font-semibold text-primary">
          {value.toLocaleString("en-US")}
          {unit}
        </span>
      </span>
      <input
        className="w-full cursor-pointer accent-primary"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

const labels: Record<string, string> = {
  expected_units: "Expected units sold",
  discounted_unit_price_mmk: "Price after discount",
  potential_cash_receipts_mmk: "Potential cash receipts",
  associated_cogs_mmk: "Associated cost of goods",
  projected_gross_result_mmk: "Projected gross result",
  potential_spending_avoided_mmk: "Potential spending avoided",
  ccc_days: "Cash conversion cycle",
  current_ccc_days: "Current cycle",
  proposed_ccc_days: "Projected cycle",
  reduction_days: "Days shortened",
  target_mmk: "Reserve target",
  dedicated_reserve_mmk: "Dedicated reserve",
  shortfall_mmk: "Amount still needed",
  affordable_monthly_contribution_mmk: "Monthly contribution",
  months_to_target: "Months to target",
};

function displayValue(key: string, value: unknown): string {
  if (value === null && key === "months_to_target") return "No timeline at this contribution";
  if (typeof value === "number" || typeof value === "string") {
    const numeric = Number(value);
    const text = Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : String(value);
    if (key.endsWith("_mmk")) return `${text} MMK`;
    if (key.endsWith("_days")) return `${text} days`;
    return text;
  }
  return String(value);
}

export function ScenarioResult({
  response,
}: {
  response: { result?: Record<string, unknown> } | null;
}) {
  if (!response?.result) return null;
  const { warning, business_impact, ...values } = response.result;
  const current = values["current"] as Record<string, unknown> | undefined;
  const proposed = values["proposed"] as Record<string, unknown> | undefined;
  const cycleMetrics: [string, unknown][] =
    current && proposed
      ? [
          ["current_ccc_days", current["ccc_days"]],
          ["proposed_ccc_days", proposed["ccc_days"]],
          ["reduction_days", Number(current["ccc_days"]) - Number(proposed["ccc_days"])],
        ]
      : [];
  const metrics = cycleMetrics.length
    ? cycleMetrics
    : Object.entries(values).filter(
        ([key, value]) =>
          (key === "months_to_target" || value !== null) &&
          !["status", "expected_date", "label", "projected_only", "current", "proposed"].includes(
            key,
          ),
      );
  return (
    <div role="status" className="mt-5 rounded-xl border border-primary/20 bg-secondary/50 p-4">
      <p className="text-sm font-semibold text-primary">Projected result · records unchanged</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {metrics.map(([key, value]) => (
          <div key={key} className="rounded-lg bg-card px-3 py-2">
            <dt className="text-xs text-muted-foreground">
              {labels[key] ?? key.replaceAll("_", " ")}
            </dt>
            <dd className="mt-1 font-semibold">{displayValue(key, value)}</dd>
          </div>
        ))}
      </dl>
      {typeof business_impact === "string" && (
        <p className="mt-3 text-xs text-muted-foreground">{business_impact}</p>
      )}
      {typeof warning === "string" && (
        <p className="mt-2 text-xs text-muted-foreground">{warning}</p>
      )}
    </div>
  );
}
