import { useTranslation } from "@/lib/i18n";
import type { DisplayInventoryRisk } from "../applyManualInputs";

function riskStatus(
  item: DisplayInventoryRisk,
): "safe" | "soon" | "high" | "no_sales" | "missing_lead" {
  if (item.status === "no_recent_sales" || item.coverage_days == null) return "no_sales";
  const coverage = Number(item.coverage_days);
  const lead = item.supplier_lead_days;
  if (lead == null || !Number.isFinite(lead) || !Number.isFinite(coverage)) return "missing_lead";
  const statedThreshold = Number(item.risk_threshold_days ?? lead + 3);
  const threshold = Number.isFinite(statedThreshold) ? Math.max(lead, statedThreshold) : lead + 3;
  if (coverage < lead) return "high";
  if (coverage <= threshold) return "soon";
  return "safe";
}

const riskStyles = {
  safe: "border-success/30 bg-success/15 text-emerald-800 dark:text-emerald-200",
  soon: "border-warning/40 bg-warning/20 text-amber-900 dark:text-amber-200",
  high: "border-destructive/30 bg-destructive/10 text-red-800 dark:text-red-200",
  no_sales: "border-border bg-muted/50 text-muted-foreground",
  missing_lead: "border-border bg-muted/50 text-muted-foreground",
} as const;

export function InventoryRiskTable({ items }: { items: DisplayInventoryRisk[] }) {
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
            <th className="px-4 py-3">{t("Average daily sales (last 30 days)")}</th>
            <th className="px-4 py-3">{t("Coverage")}</th>
            <th className="px-4 py-3">{t("Risk")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const risk = riskStatus(item);
            const riskLabel = {
              safe: "Safe",
              soon: "Order Soon",
              high: "High Risk",
              no_sales: "No recent sales",
              missing_lead: "Need supplier lead time",
            }[risk];
            return (
              <tr key={item.product_id} className="border-t last:border-b-0">
                <td className="px-4 py-3 font-medium">
                  {item.name}
                  {item.slow_moving && (
                    <span className="ml-2 rounded-full bg-warning/20 px-2 py-0.5 text-xs">
                      {t("Slow-moving")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {String(item.current_stock_qty)}
                  {item.manualStock && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {t("Source: Manual Entry")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.average_units_sold_per_day_30 == null
                    ? "—"
                    : Number(item.average_units_sold_per_day_30).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  {item.coverage_days == null
                    ? t("No recent sales")
                    : t("{0} days", { "0": item.coverage_days })}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${riskStyles[risk]}`}
                  >
                    {t(riskLabel)}
                  </span>
                  {risk !== "no_sales" && risk !== "missing_lead" && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t(item.manualLeadTime ? "Source: Manual Entry" : "Source: Excel")}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
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
