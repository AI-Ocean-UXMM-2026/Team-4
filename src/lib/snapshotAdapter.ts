// Adapter for the existing Lovable prototype; P1-P4 replace their own projections.
// MMK -> MMK thousands happens only at this display boundary.
import type { Snapshot } from "./contracts";
export type DisplayData = {
  cashIn: number;
  cashOut: number;
  stock: number;
  debt: number;
  cash: number;
  hasCredit: boolean;
};
export function snapshotDisplay(snapshot: Snapshot) {
  const t = snapshot.tables,
    opening = t.Settings[0];
  if (!opening) return null;
  const events: { date: string; inflow: number; outflow: number }[] = [];
  const add = (date: string, inflow: number, outflow: number) =>
    events.push({ date, inflow, outflow });
  t.Sales.forEach((r) => add(r.date, Number(r.cash_received_mmk), 0));
  t.CustomerReceipts.forEach((r) => add(r.date, Number(r.amount_mmk), 0));
  t.Loans.forEach((r) => add(r.date, Number(r.principal_mmk), 0));
  t.Purchases.forEach((r) => add(r.date, 0, Number(r.cash_paid_mmk)));
  t.SupplierPayments.forEach((r) => add(r.date, 0, Number(r.amount_mmk)));
  t.Expenses.forEach((r) => add(r.date, 0, Number(r.amount_mmk)));
  t.LoanPayments.forEach((r) => add(r.date, 0, Number(r.principal_mmk) + Number(r.interest_mmk)));
  t.CashAdjustments.forEach((r) =>
    add(
      r.date,
      r.direction === "in" ? Number(r.amount_mmk) : 0,
      r.direction === "out" ? Number(r.amount_mmk) : 0,
    ),
  );
  const latest = events.reduce(
    (last, event) => (event.date > last ? event.date : last),
    opening.opening_date,
  );
  const month = latest.slice(0, 7),
    [year = 2026, monthNumber = 10] = month.split("-").map(Number);
  const monthEvents = events.filter((event) => event.date.startsWith(month));
  const initialCash =
    (Number(opening.opening_cash_mmk) +
      events
        .filter((event) => event.date < month + "-01")
        .reduce((s, e) => s + e.inflow - e.outflow, 0)) /
    1000;
  const days = Array.from(
    { length: new Date(Date.UTC(year, monthNumber, 0)).getUTCDate() },
    (_, i) => {
      const daily = monthEvents.filter((event) => Number(event.date.slice(8, 10)) === i + 1);
      return {
        day: i + 1,
        inflow: daily.reduce((s, e) => s + e.inflow, 0) / 1000,
        outflow: daily.reduce((s, e) => s + e.outflow, 0) / 1000,
      };
    },
  );
  const cashIn = monthEvents.reduce((s, e) => s + e.inflow, 0) / 1000,
    cashOut = monthEvents.reduce((s, e) => s + e.outflow, 0) / 1000;
  const stock =
    t.Products.reduce((sum, product) => {
      const bought = t.Purchases.filter((r) => r.product_id === product.product_id).reduce(
        (s, r) => s + Number(r.quantity),
        0,
      );
      const sold = t.Sales.filter((r) => r.product_id === product.product_id).reduce(
        (s, r) => s + Number(r.quantity),
        0,
      );
      return sum + (Number(product.opening_stock) + bought - sold) * Number(product.unit_cost_mmk);
    }, 0) / 1000;
  const debt =
    (t.Loans.reduce((s, r) => s + Number(r.principal_mmk), 0) -
      t.LoanPayments.reduce((s, r) => s + Number(r.principal_mmk), 0)) /
    1000;
  const data: DisplayData = {
    cashIn,
    cashOut,
    stock,
    debt,
    cash: initialCash + cashIn - cashOut,
    hasCredit: debt > 0,
  };
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  return { data, days, initialCash, monthLabel };
}
