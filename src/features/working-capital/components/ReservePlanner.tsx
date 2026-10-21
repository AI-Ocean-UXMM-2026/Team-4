import { useState } from "react";
import { RangeField, ScenarioResult } from "./ScenarioUI";

type Response = { result: Record<string, unknown> };

export function ReservePlanner({
  planReserve,
}: {
  planReserve: <T>(payload: Record<string, unknown>) => Promise<T>;
}) {
  const [months, setMonths] = useState(3);
  const [contribution, setContribution] = useState(100000);
  const [result, setResult] = useState<Response | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await planReserve<Response>({
          monthly_essential_costs_mmk: 500000,
          dedicated_reserve_mmk: 300000,
          target_months: months,
          monthly_contribution_mmk: contribution,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not calculate the reserve plan.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="bf-card space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 3</p>
        <h2 className="mt-1 text-xl font-bold">Build a safety reserve</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Plan with example monthly essential costs of 500,000 MMK and a dedicated reserve of
          300,000 MMK. These are not imported figures; dedicated reserve differs from total cash.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <RangeField
          label="Target coverage"
          value={months}
          min={1}
          max={6}
          unit=" months"
          onChange={setMonths}
        />
        <RangeField
          label="Monthly contribution"
          value={contribution}
          min={0}
          max={1000000}
          step={10000}
          unit=" MMK"
          onChange={setContribution}
        />
      </div>
      <button className="bf-button" disabled={pending} onClick={() => void run()}>
        {pending ? "Planning…" : "Plan reserve milestones"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ScenarioResult response={result} />
    </section>
  );
}
