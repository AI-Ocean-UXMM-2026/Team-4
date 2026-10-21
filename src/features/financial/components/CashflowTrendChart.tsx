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
import type { Trends } from "../types";
import { formatMmk } from "../types";

const shortPeriod = (start: string) => {
  const date = new Date(`${start}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? start
    : new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
        date,
      );
};

export function CashflowTrendChart({ trends }: { trends: Trends }) {
  if (!trends.points.length)
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Revenue and operating expenses</h2>
        <div className="mt-5 rounded-xl bg-slate-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">No trend data available yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Import records covering more than one reporting period to see a comparison.
          </p>
        </div>
      </section>
    );
  const chartData = trends.points.map((point) => ({
    ...point,
    label: shortPeriod(point.period.start),
    range: `${point.period.start} – ${point.period.end}`,
  }));
  return (
    <section
      className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,.035)] sm:p-5"
      aria-label="Revenue and operating expense trends"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-teal-700">
            Performance over time
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
            Revenue and operating expenses
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Recorded amounts by period. These are not cash movements.
          </p>
        </div>
        <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
          Final period may be partial
        </span>
      </div>
      <div className="mt-4 min-w-0" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#e8edf1" strokeDasharray="4 5" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={18}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
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
              formatter={(value: number) => formatMmk(value)}
              contentStyle={{
                borderRadius: 14,
                borderColor: "#e2e8f0",
                boxShadow: "0 10px 30px rgba(15,23,42,.1)",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Line
              type="monotone"
              dataKey="revenue_mmk"
              name="Revenue"
              stroke="#0f766e"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#0f766e", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="operating_expenses_mmk"
              name="Operating expenses"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[510px] text-left text-xs sm:text-sm">
          <caption className="sr-only">
            Exact trend figures; unavailable values are not zero
          </caption>
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-3 py-2.5">
                Period
              </th>
              <th scope="col" className="px-3 py-2.5">
                Revenue
              </th>
              <th scope="col" className="px-3 py-2.5">
                Operating expenses
              </th>
            </tr>
          </thead>
          <tbody>
            {trends.points.map((point) => (
              <tr key={point.period.start} className="border-t border-slate-100">
                <th scope="row" className="px-3 py-2.5 font-medium text-slate-600">
                  {point.period.start} – {point.period.end}
                </th>
                <td className="px-3 py-2.5 font-medium text-teal-800">
                  {formatMmk(point.revenue_mmk)}
                </td>
                <td className="px-3 py-2.5 font-medium text-amber-800">
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
