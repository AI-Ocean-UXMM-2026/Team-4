import { useState } from "react";

export function ReservePlanner({
  planReserve,
}: {
  planReserve: <T>(payload: Record<string, unknown>) => Promise<T>;
}) {
  const [months, setMonths] = useState(3),
    [contribution, setContribution] = useState(100000),
    [result, setResult] = useState<unknown>();
  return (
    <section>
      <h2>Step 3: Build Safety Reserve</h2>
      <p>
        Illustrative example: MMK 500,000 monthly essential costs and MMK 300,000 dedicated reserve.
        These are not imported business figures. A dedicated reserve is not total cash.
      </p>
      <label>
        Target months: {months}
        <input
          type="range"
          min="1"
          max="6"
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
        />
      </label>
      <label>
        Affordable monthly contribution (MMK): {contribution}
        <input
          type="range"
          min="0"
          max="1000000"
          step="10000"
          value={contribution}
          onChange={(e) => setContribution(Number(e.target.value))}
        />
      </label>
      <button
        onClick={() =>
          void planReserve<unknown>({
            monthly_essential_costs_mmk: 500000,
            dedicated_reserve_mmk: 300000,
            target_months: months,
            monthly_contribution_mmk: contribution,
          }).then(setResult)
        }
      >
        Plan reserve milestones
      </button>
      {result !== undefined && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </section>
  );
}
