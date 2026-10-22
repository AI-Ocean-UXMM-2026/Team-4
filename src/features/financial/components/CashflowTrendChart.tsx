import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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

function isPartialPeriod(start: string, end: string) {
  const date = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);
  return end < monthEnd;
}

function recordCountLabel(count: number) {
  return `${count} ${count === 1 ? "record" : "records"}`;
}

export function CashflowTrendChart({ trends }: { trends: Trends }) {
  if (!trends.points.length)
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Revenue and operating expenses</h2>
        <div className="mt-5 rounded-xl bg-slate-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">No reporting periods available.</p>
          <p className="mt-1 text-sm text-slate-500">
            Import records covering more than one reporting period to see a comparison.
          </p>
        </div>
      </section>
    );

  const chartData = trends.points
    .filter(
      (point) =>
        (point.revenue_record_count ?? 0) > 0 || (point.operating_expense_record_count ?? 0) > 0,
    )
    .map((point) => {
      const partial = isPartialPeriod(point.period.start, point.period.end);
      return {
        ...point,
        label: `${shortPeriod(point.period.start)}${partial ? "*" : ""}`,
        range: `${point.period.start} – ${point.period.end}`,
        partial,
        revenueBar: point.revenue_record_count ? point.revenue_mmk : null,
        expensesBar: point.operating_expense_record_count ? point.operating_expenses_mmk : null,
      };
    });
  const recordCountsAvailable = trends.points.every(
    (point) => point.revenue_record_count !== null && point.operating_expense_record_count !== null,
  );
  const lastPeriod = trends.points.at(-1);
  const partialDescription =
    lastPeriod && isPartialPeriod(lastPeriod.period.start, lastPeriod.period.end)
      ? `The latest period, ${lastPeriod.period.start}–${lastPeriod.period.end}, is partial.`
      : "The periods shown are complete calendar months.";
  const explanation = `${partialDescription} Operating expenses exclude cost of goods sold (COGS), and revenue is not profit.`;

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
            Monthly trend · latest 3 calendar months. These amounts are not cash movements.
          </p>
        </div>
        <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
          * Partial reporting period
        </span>
      </div>

      {chartData.length ? (
        <div className="mt-4 min-w-0" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
              barCategoryGap="24%"
              aria-label="Grouped monthly bar chart for revenue and operating expenses"
            >
              <CartesianGrid stroke="#e8edf1" strokeDasharray="4 5" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={12}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(value: number) =>
                  value >= 1_000_000
                    ? `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}m`
                    : value >= 1_000
                      ? `${Math.round(value / 1_000)}k`
                      : `${value}`
                }
              />
              <Tooltip
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload;
                  return point ? `${point.range}${point.partial ? " · Partial period" : ""}` : "";
                }}
                formatter={(value: number, name: string) => [formatMmk(value), name]}
                contentStyle={{
                  borderRadius: 14,
                  borderColor: "#e2e8f0",
                  boxShadow: "0 10px 30px rgba(15,23,42,.1)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="revenueBar" name="Revenue" fill="#0f766e" radius={[5, 5, 0, 0]} />
              <Bar
                dataKey="expensesBar"
                name="Operating expenses"
                fill="#f59e0b"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-slate-50 px-5 py-8 text-center" role="status">
          <p className="text-sm font-medium text-slate-700">
            {recordCountsAvailable
              ? "No revenue or operating expense records in these periods."
              : "Trend data is unavailable for these periods."}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {recordCountsAvailable
              ? "Months without records are omitted from the chart; they are not treated as recorded zeroes."
              : "The available data cannot confirm whether the months had no activity or missing records."}
          </p>
        </div>
      )}

      <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-600">
        {explanation}
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[510px] text-left text-xs sm:text-sm">
          <caption className="sr-only">
            Monthly revenue and operating expenses, exact MMK amounts and record counts; months
            without records are distinguished from recorded zeroes.
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
            {trends.points.map((point) => {
              const partial = isPartialPeriod(point.period.start, point.period.end);
              const metricCell = (
                amount: number | string | null,
                count: number | null,
                color: string,
              ) => (
                <td className={`px-3 py-2.5 font-medium ${color}`}>
                  <span className="block">
                    {count === null || amount === null
                      ? "Unavailable"
                      : count === 0
                        ? "No records"
                        : formatMmk(amount)}
                  </span>
                  {count !== null && count > 0 && (
                    <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                      {recordCountLabel(count)}
                    </span>
                  )}
                </td>
              );
              return (
                <tr key={point.period.start} className="border-t border-slate-100">
                  <th scope="row" className="px-3 py-2.5 font-medium text-slate-600">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold tabular-nums text-slate-700 shadow-sm sm:text-xs">
                        {point.period.start} – {point.period.end}
                      </span>
                      {partial && (
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
                          Partial
                        </span>
                      )}
                    </span>
                  </th>
                  {metricCell(point.revenue_mmk, point.revenue_record_count, "text-teal-800")}
                  {metricCell(
                    point.operating_expenses_mmk,
                    point.operating_expense_record_count,
                    "text-amber-800",
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
