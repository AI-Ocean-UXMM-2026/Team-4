import type { InventoryRisk } from "../hooks/useWorkingCapital";

export function InventoryRiskTable({ items }: { items: InventoryRisk[] }) {
  if (!items.length) return <p>No imported product and sales data is available yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Stock</th>
            <th>7 / 30-day sales</th>
            <th>Coverage</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.product_id}>
              <td>
                {item.name}
                {item.slow_moving && <small> Slow-moving</small>}
              </td>
              <td>{String(item.current_stock_qty)}</td>
              <td>
                {item.average_units_sold_per_day_7 ?? "—"} /{" "}
                {item.average_units_sold_per_day_30 ?? "—"}
              </td>
              <td>
                {item.coverage_days == null ? "No recent sales" : `${item.coverage_days} days`}
              </td>
              <td>
                {item.stockout_risk === true
                  ? "Stockout risk"
                  : item.stockout_risk === false
                    ? "Within stated lead time"
                    : item.status === "no_recent_sales"
                      ? "No recent sales"
                      : "Need supplier lead time"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <small>
          Slow-moving rule: no sales in the observed 30-day window; demo-configurable, not
          universal.
        </small>
      </p>
    </div>
  );
}
