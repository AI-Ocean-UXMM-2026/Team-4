import { useState } from "react";

type Result = { result?: Record<string, unknown> };
export function UnlockCashSimulator({
  simulate,
}: {
  simulate: <T>(type: string, assumptions: Record<string, unknown>) => Promise<T>;
}) {
  const [discount, setDiscount] = useState(20);
  const [sellThrough, setSellThrough] = useState(50);
  const [collectionPct, setCollectionPct] = useState(50);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const runSlowStock = async () =>
    setResult(
      await simulate<Result>("slow_stock", {
        quantity: 10,
        selling_price_mmk: 100000,
        unit_cost_mmk: 90000,
        discount_pct: discount,
        sell_through_pct: sellThrough,
      }),
    );
  const runCollection = async () =>
    setResult(
      await simulate<Result>("receivable_collection", {
        outstanding_mmk: 500000,
        collection_pct: collectionPct,
      }),
    );
  const runExpensePause = async () =>
    setResult(
      await simulate<Result>("expense_pause", {
        amount_mmk: 100000,
        is_paid: alreadyPaid,
        is_immutable: false,
        business_impact: "Pausing marketing may reduce future sales.",
      }),
    );
  return (
    <section>
      <h2>Step 1: Unlock Hidden Cash</h2>
      <p>
        Illustrative example assumptions: 10 units at MMK 100,000 selling price and MMK 90,000 unit
        cost; MMK 500,000 receivables; MMK 100,000 optional expense. These are not imported business
        figures. Projections do not change records.
      </p>
      <h3>Discounted slow-stock recovery</h3>
      <label>
        Discount: {discount}%{" "}
        <input
          type="range"
          min="0"
          max="70"
          value={discount}
          onChange={(e) => setDiscount(Number(e.target.value))}
        />
      </label>
      <label>
        Expected sell-through: {sellThrough}%{" "}
        <input
          type="range"
          min="0"
          max="100"
          value={sellThrough}
          onChange={(e) => setSellThrough(Number(e.target.value))}
        />
      </label>
      <button onClick={() => void runSlowStock()}>Project slow-stock sale</button>
      <h3>Receivables collection proposal</h3>
      <label>
        Target collection: {collectionPct}%{" "}
        <input
          type="range"
          min="0"
          max="100"
          value={collectionPct}
          onChange={(e) => setCollectionPct(Number(e.target.value))}
        />
      </label>
      <button onClick={() => void runCollection()}>Project collection timing</button>
      <h3>Optional expense pause</h3>
      <label>
        <input
          type="checkbox"
          checked={alreadyPaid}
          onChange={(e) => setAlreadyPaid(e.target.checked)}
        />{" "}
        Expense already paid
      </label>
      <button onClick={() => void runExpensePause()} disabled={alreadyPaid}>
        Project spending avoided
      </button>
      {result && <pre>{JSON.stringify(result.result, null, 2)}</pre>}
    </section>
  );
}
