import { useTranslation } from "@/lib/i18n";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Money, Trends } from "../types";
import { formatMmk } from "../types";

const shortPeriod = (start: string) => {
  const date = new Date(`${start}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? start
    : new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
        date,
      );
};

// Plot numeric coordinates, retaining exact decimal strings for labels and tables.
const plotValue = (value: Money) => {
  if (value === null || !/^-?\d+(\.\d+)?$/.test(String(value))) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export function CashflowTrendChart({ trends }: { trends: Trends }) {
  const { t } = useTranslation();

  if (!trends.points.length)
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">
          {t("Revenue and operating expenses")}
        </h2>
        <div className="mt-5 rounded-xl bg-muted px-5 py-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {t("No reporting periods available.")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Import records covering more than one reporting period to see a comparison.")}
          </p>
        </div>
      </section>
    );
  const chartData = trends.points.map((point) => ({
    ...point,
    exact: point,
    revenue_mmk: plotValue(point.revenue_mmk),
    operating_expenses_mmk: plotValue(point.operating_expenses_mmk),
    label: shortPeriod(point.period.start),
    range: `${point.period.start} – ${point.period.end}`,
  }));
  return (
    <section
      className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[0_4px_18px_rgba(15,23,42,.035)] sm:p-5"
      aria-label={t("Revenue and operating expense trends")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">
            {t("Performance over time")}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {t("Revenue and operating expenses")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Recorded amounts by period. These are not cash movements.")}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          {t("Final period may be partial")}
        </span>
      </div>
      <div className="mt-4 min-w-0" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 5" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={18}
            />
            <YAxis
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={66}
              tickFormatter={(value: number) =>
                value >= 1_000_000
                  ? `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}m`
                  : value >= 1_000
                    ? `${Math.round(value / 1_000)}k`
                    : `${value}`
              }
            />
            <Tooltip
              labelFormatter={(_, payload) => payload?.[0]?.payload?.range ?? ""}
              formatter={(_value, _name, item) =>
                formatMmk(
                  item.dataKey === "revenue_mmk"
                    ? item.payload.exact.revenue_mmk
                    : item.payload.exact.operating_expenses_mmk,
                )
              }
              contentStyle={{
                borderRadius: 14,
                borderColor: "var(--border)",
                background: "var(--card)",
                color: "var(--foreground)",
                boxShadow: "0 10px 30px rgba(15,23,42,.1)",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Line
              type="monotone"
              dataKey="revenue_mmk"
              isAnimationActive={false}
              name={t("Revenue")}
              stroke="var(--chart-revenue)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--chart-revenue)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="operating_expenses_mmk"
              isAnimationActive={false}
              name={t("Operating expenses")}
              stroke="var(--chart-expenses)"
              strokeDasharray="5 4"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--chart-expenses)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[510px] text-left text-xs sm:text-sm">
          <caption className="sr-only">
            {t("Exact trend figures; unavailable values are not zero")}
          </caption>
          <thead className="bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2.5">
                {t("Period")}
              </th>
              <th scope="col" className="px-3 py-2.5">
                {t("Revenue")}
              </th>
              <th scope="col" className="px-3 py-2.5">
                {t("Operating expenses")}
              </th>
            </tr>
          </thead>
          <tbody>
            {trends.points.map((point) => (
              <tr key={point.period.start} className="border-t border-border">
                <th scope="row" className="px-3 py-2.5 font-medium text-muted-foreground">
                  {point.period.start} – {point.period.end}
                </th>
                <td className="px-3 py-2.5 font-medium text-primary">
                  {formatMmk(point.revenue_mmk)}
                </td>
                <td className="px-3 py-2.5 font-medium text-cyan-800 dark:text-cyan-200">
                  {formatMmk(point.operating_expenses_mmk)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
