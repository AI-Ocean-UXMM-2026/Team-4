import { useState } from "react";
import { RangeField, ScenarioResult } from "./ScenarioUI";

type Response = { result: Record<string, unknown> };

export function UnlockCashSimulator({
  simulate,
}: {
  simulate: <T>(type: string, assumptions: Record<string, unknown>) => Promise<T>;
}) {
  const [discount, setDiscount] = useState(20);
  const [sellThrough, setSellThrough] = useState(50);
  const [collectionPct, setCollectionPct] = useState(50);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [result, setResult] = useState<Response | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(type: string, assumptions: Record<string, unknown>) {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      setResult(await simulate<Response>(type, assumptions));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not calculate this scenario.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="bf-card space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 1</p>
        <h2 className="mt-1 text-xl font-bold">Unlock hidden cash</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Try example stock, collection, and expense choices. These numbers are illustrative, and
          projections do not change records.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
          <div>
            <h3 className="font-semibold">Discount slow stock</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Example: 10 units · 100,000 MMK price · 90,000 MMK unit cost
            </p>
          </div>
          <RangeField
            label="Discount"
            value={discount}
            min={0}
            max={70}
            unit="%"
            onChange={setDiscount}
          />
          <RangeField
            label="Expected sell-through"
            value={sellThrough}
            min={0}
            max={100}
            unit="%"
            onChange={setSellThrough}
          />
          <button
            className="bf-button w-full"
            disabled={pending}
            onClick={() =>
              void run("slow_stock", {
                quantity: 10,
                selling_price_mmk: 100000,
                unit_cost_mmk: 90000,
                discount_pct: discount,
                sell_through_pct: sellThrough,
              })
            }
          >
            Project stock sale
          </button>
        </div>
        <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
          <div>
            <h3 className="font-semibold">Collect receivables</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Example outstanding amount: 500,000 MMK
            </p>
          </div>
          <RangeField
            label="Target collection"
            value={collectionPct}
            min={0}
            max={100}
            unit="%"
            onChange={setCollectionPct}
          />
          <button
            className="bf-button w-full"
            disabled={pending}
            onClick={() =>
              void run("receivable_collection", {
                outstanding_mmk: 500000,
                collection_pct: collectionPct,
              })
            }
          >
            Project collection
          </button>
        </div>
        <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
          <div>
            <h3 className="font-semibold">Pause optional spending</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Example optional expense: 100,000 MMK
            </p>
          </div>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border bg-background p-4 text-sm">
            <input
              type="checkbox"
              checked={alreadyPaid}
              onChange={(event) => setAlreadyPaid(event.target.checked)}
              className="accent-primary"
            />
            Expense already paid
          </label>
          <p className="text-xs text-muted-foreground">
            A paid expense cannot release future cash.
          </p>
          <button
            className="bf-button w-full"
            disabled={pending || alreadyPaid}
            onClick={() =>
              void run("expense_pause", {
                amount_mmk: 100000,
                is_paid: alreadyPaid,
                is_immutable: false,
                business_impact: "Pausing marketing may reduce future sales.",
              })
            }
          >
            Project spending avoided
          </button>
        </div>
      </div>
      {pending && (
        <p role="status" className="text-sm text-muted-foreground">
          Calculating scenario…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ScenarioResult response={result} />
    </section>
  );
}
