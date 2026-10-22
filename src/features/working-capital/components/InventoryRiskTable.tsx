import { useTranslation } from "@/lib/i18n";
import type { InventoryRisk } from "../hooks/useWorkingCapital";

export function InventoryRiskTable({ items }: { items: InventoryRisk[] }) {
  const { t } = useTranslation();

  if (!items.length)
    return (
      <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
        {t("No imported product and sales data is available yet.")}
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">{t("Product")}</th>
            <th className="px-4 py-3">{t("Stock")}</th>
            <th className="px-4 py-3">{t("7 / 30-day sales")}</th>
            <th className="px-4 py-3">{t("Coverage")}</th>
            <th className="px-4 py-3">{t("Risk")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.product_id} className="border-t last:border-b-0">
              <td className="px-4 py-3 font-medium">
                {item.name}
                {item.slow_moving && (
                  <span className="ml-2 rounded-full bg-warning/20 px-2 py-0.5 text-xs">
                    {t("Slow-moving")}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">{String(item.current_stock_qty)}</td>
              <td className="px-4 py-3">
                {item.average_units_sold_per_day_7 ?? "—"} /{" "}
                {item.average_units_sold_per_day_30 ?? "—"}
              </td>
              <td className="px-4 py-3">
                {item.coverage_days == null
                  ? t("No recent sales")
                  : t("{0} days", { "0": item.coverage_days })}
              </td>
              <td className="px-4 py-3">
                {item.stockout_risk === true
                  ? t("Stockout risk")
                  : item.stockout_risk === false
                    ? t("Within stated lead time")
                    : item.status === "no_recent_sales"
                      ? t("No recent sales")
                      : t("Need supplier lead time")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t px-4 py-3 text-xs text-muted-foreground">
        {t(
          "Slow-moving means no sales in the 30-day window ending at the latest inventory activity date.",
        )}
      </p>
    </div>
  );
}
