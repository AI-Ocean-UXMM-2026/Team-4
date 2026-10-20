import { useMemo, useState } from "react";

type Data = {
  cashIn: number;
  cashOut: number;
  stock: number;
  debt: number;
  cash: number;
  hasCredit: boolean;
};
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " K";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border bg-card p-5 shadow-sm ${className}`}>{children}</div>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-2 font-display text-2xl font-bold ${tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : ""}`}
      >
        {value}
      </p>
    </Card>
  );
}

export function Dashboard({
  data,
  days,
  initialCash,
  monthLabel,
}: {
  data: Data;
  days: { day: number; inflow: number; outflow: number }[];
  initialCash: number;
  monthLabel: string;
}) {
  let bal = initialCash;
  const series = days.map((d) => ({ ...d, bal: (bal += d.inflow - d.outflow) }));
  const max = Math.max(...series.map((s) => s.bal)),
    min = Math.min(...series.map((s) => s.bal));
  const W = 900,
    H = 220;
  const pts = series
    .map(
      (s, i) =>
        `${(i / (days.length - 1 || 1)) * W},${H - ((s.bal - min) / (max - min || 1)) * (H - 20) - 10}`,
    )
    .join(" ");
  const totalIn = days.reduce((a, d) => a + d.inflow, 0),
    totalOut = days.reduce((a, d) => a + d.outflow, 0);
  const net = totalIn - totalOut;
  const barMax = Math.max(1, ...days.map((d) => Math.max(d.inflow, d.outflow)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{monthLabel} cashflow</h1>
        <p className="text-muted-foreground">
          Track your money going up or down day by day. (Amounts in MMK thousands)
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cash in (month)" value={fmt(totalIn)} tone="up" />
        <Stat label="Cash out (month)" value={fmt(totalOut)} tone="down" />
        <Stat
          label="Net flow"
          value={(net >= 0 ? "▲ " : "▼ ") + fmt(Math.abs(net))}
          tone={net >= 0 ? "up" : "down"}
        />
        <Stat label="Remaining debt" value={data.hasCredit ? fmt(data.debt) : "No credit"} />
      </div>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Cash balance trend</h2>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${net >= 0 ? "bg-secondary text-success" : "bg-muted text-destructive"}`}
          >
            {net >= 0 ? "Trending up" : "Trending down"}
          </span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full">
          <polyline points={`0,${H} ${pts} ${W},${H}`} className="fill-primary/10" />
          <polyline points={pts} fill="none" className="stroke-primary" strokeWidth="3" />
        </svg>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Day 1</span>
          <span>Day 15</span>
          <span>Day {days.length}</span>
        </div>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Daily cash in vs cash out</h2>
        <div className="flex h-40 items-end gap-1">
          {days.map((d) => (
            <div
              key={d.day}
              className="flex h-full flex-1 items-end gap-px"
              title={`Day ${d.day}: +${d.inflow} / -${d.outflow}`}
            >
              <div
                className="flex-1 rounded-t bg-success"
                style={{ height: `${(d.inflow / barMax) * 100}%` }}
              />
              <div
                className="flex-1 rounded-t bg-destructive/70"
                style={{ height: `${(d.outflow / barMax) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs">
          <span className="flex items-center gap-1">
            <i className="h-3 w-3 rounded bg-success" />
            Cash in
          </span>
          <span className="flex items-center gap-1">
            <i className="h-3 w-3 rounded bg-destructive/70" />
            Cash out
          </span>
        </div>
      </Card>
    </div>
  );
}

function analyze(d: Data) {
  const profit = d.cashIn - d.cashOut;
  const margin = d.cashIn ? profit / d.cashIn : 0;
  const runway = d.cashOut ? d.cash / (d.cashOut / 30) : 0;
  const stockRatio = d.cashIn ? d.stock / d.cashIn : 0;
  const debtMonths = profit > 0 ? d.debt / (profit * 0.4) : Infinity;
  const safeLoanMonth = Math.max(0, Math.round(profit * 0.35));
  return {
    profit,
    margin,
    runway,
    stockRatio,
    debtMonths,
    safeLoanMonth,
    safeLoanYear: safeLoanMonth * 12,
    forecast: [1, 2, 3].map((m) => Math.round(d.cash + profit * m * 0.9)),
  };
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

export function AIAnalysis({ data, setData }: { data: Data; setData: (d: Data) => void }) {
  const [ran, setRan] = useState(true);
  const a = useMemo(() => analyze(data), [data]);
  const set = (k: keyof Data) => (n: number) => {
    setData({ ...data, [k]: n });
  };

  const tips = {
    profit: [
      a.margin < 0.15
        ? "Margin is thin — raise prices 5–8% on your top-selling items."
        : "Healthy margin — reinvest in your best-selling product line.",
      "Bundle slow items with popular ones to lift average order value.",
      "Offer small discounts for upfront or cash payments.",
    ],
    cost: [
      a.stockRatio > 0.3
        ? `Stock is ${(a.stockRatio * 100).toFixed(0)}% of monthly sales — cut reorders by ~20%.`
        : "Stock level is balanced. Keep weekly reorder reviews.",
      "Negotiate 30-day payment terms with your top 2 suppliers.",
      "Review recurring expenses (rent, utilities, subscriptions) for 10% savings.",
    ],
    debt: data.hasCredit
      ? [
          `Put 40% of monthly profit toward debt → cleared in ~${isFinite(a.debtMonths) ? Math.ceil(a.debtMonths) : "∞"} months.`,
          "Pay highest-interest debt first (avalanche method).",
          "Avoid new short-term loans until debt is below 2× monthly profit.",
        ]
      : ["You have no debt — focus on building a 3-month cash reserve."],
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Card className="h-fit">
        <h2 className="text-lg font-semibold">Imported cash movements</h2>
        <p className="mb-4 text-sm text-muted-foreground">MMK thousands</p>
        <div className="space-y-3">
          <Field label="Cash in" value={data.cashIn} onChange={set("cashIn")} />
          <Field label="Cash out" value={data.cashOut} onChange={set("cashOut")} />
          <Field label="Stock amount" value={data.stock} onChange={set("stock")} />
          <Field label="Remaining debt" value={data.debt} onChange={set("debt")} />
          <Field label="Remaining total cash" value={data.cash} onChange={set("cash")} />
        </div>
        <button
          onClick={() => setRan(true)}
          className="mt-5 w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90"
        >
          ✨ Update local scenario
        </button>
      </Card>
      {ran && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Cash surplus" value={fmt(a.profit)} tone={a.profit >= 0 ? "up" : "down"} />
            <Stat label="Cash surplus ratio" value={(a.margin * 100).toFixed(1) + "%"} />
            <Stat label="Cash runway" value={Math.round(a.runway) + " days"} />
          </div>
          <Card>
            <h3 className="mb-3 font-semibold">📈 Predicted cash (next 3 months)</h3>
            <div className="grid grid-cols-3 gap-3">
              {a.forecast.map((f, i) => (
                <div key={i} className="rounded-lg bg-muted p-3 text-center">
                  <p className="text-xs text-muted-foreground">Month +{i + 1}</p>
                  <p
                    className={`font-display text-xl font-bold ${f >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {fmt(f)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <div className="rounded-xl bg-primary p-5 text-primary-foreground">
            <h3 className="font-semibold">💰 Prototype repayment scenario</h3>
            <p className="mt-1 text-sm opacity-90">
              Based on 35% of monthly profit as safe repayment capacity.
            </p>
            <div className="mt-3 flex gap-8">
              <div>
                <p className="text-xs opacity-80">Per month</p>
                <p className="font-display text-3xl font-bold">{fmt(a.safeLoanMonth)}</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Per year</p>
                <p className="font-display text-3xl font-bold">{fmt(a.safeLoanYear)}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(
              [
                ["⬆ Increase profit", tips.profit],
                ["✂ Reduce cost", tips.cost],
                ["🔻 Reduce debt", tips.debt],
              ] as const
            ).map(([t, list]) => (
              <Card key={t}>
                <h4 className="mb-2 font-semibold">{t}</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {list.map((x) => (
                    <li key={x}>• {x}</li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  set,
  min,
  max,
  unit = "",
  hint,
}: {
  label: string;
  value: number;
  set: (n: number) => void;
  min: number;
  max: number;
  unit?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-bold text-primary">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => set(+e.target.value)}
        className="mt-1 w-full accent-primary"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </label>
  );
}

function Toggle({
  on,
  set,
  label,
  effect,
}: {
  on: boolean;
  set: (b: boolean) => void;
  label: string;
  effect: string;
}) {
  return (
    <button
      onClick={() => set(!on)}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm ${on ? "border-primary bg-primary/10" : "bg-card"}`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`grid h-5 w-5 place-items-center rounded border text-xs ${on ? "bg-primary text-primary-foreground" : ""}`}
        >
          {on ? "✓" : ""}
        </span>
        {label}
      </span>
      <span className="whitespace-nowrap text-xs font-semibold text-success">{effect}</span>
    </button>
  );
}

export function Survive({ data, goCredit }: { data: Data; goCredit: () => void }) {
  const a = analyze(data);
  // Step 1 — Unlock hidden cash
  const [deadPct, setDeadPct] = useState(30);
  const [discount, setDiscount] = useState(20);
  const [receivable, setReceivable] = useState(4800);
  const [collectPct, setCollectPct] = useState(50);
  const expenses = [
    { n: "Advertising / boosting posts", v: 450 },
    { n: "New equipment / decoration", v: 600 },
    { n: "Extra staff overtime", v: 300 },
    { n: "Non-essential travel", v: 150 },
  ];
  const [frozen, setFrozen] = useState<string[]>([
    "Advertising / boosting posts",
    "New equipment / decoration",
  ]);
  const stockCash = Math.round(data.stock * (deadPct / 100) * (1 - discount / 100));
  const debtCash = Math.round(receivable * (collectPct / 100));
  const saved = expenses.filter((e) => frozen.includes(e.n)).reduce((s, e) => s + e.v, 0);
  const unlocked = stockCash + debtCash + saved;
  const weeks = data.cashOut ? (unlocked / (data.cashOut / 4.3)).toFixed(1) : "—";

  // Step 2 — Hybrid cash gap
  const [b2b, setB2b] = useState(30);
  const [b2bDays, setB2bDays] = useState(30);
  const [dio, setDio] = useState(25);
  const [dpo, setDpo] = useState(10);
  const [deposit, setDeposit] = useState(false);
  const [fastStock, setFastStock] = useState(false);
  const [supplier, setSupplier] = useState(false);
  const dso = (b2b / 100) * b2bDays;
  const baseGap = Math.max(0, Math.round(dio + dso - dpo));
  const newDso = (b2b / 100) * (deposit ? b2bDays * 0.4 : b2bDays);
  const newDio = fastStock ? Math.max(5, dio - 10) : dio;
  const newDpo = supplier ? dpo + 15 : dpo;
  const newGap = Math.max(0, Math.round(newDio + newDso - newDpo));
  const daily = data.cashOut / 30;
  const trapped = Math.round(baseGap * daily),
    newTrapped = Math.round(newGap * daily);
  const gapTone = (g: number) =>
    g === 0 ? "text-success" : g <= 10 ? "text-warning" : "text-destructive";

  // Step 3 — roadmap
  const reserve = Math.round(data.cashOut * 3);
  const save = Math.max(0, Math.round(a.profit * 0.3));
  const startCash = data.cash + unlocked;
  const months = save ? Math.ceil(Math.max(0, reserve - startCash) / save) : "—";
  const progress = Math.min(100, Math.round((startCash / reserve) * 100));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">No-credit survival toolkit</h1>
        <p className="text-muted-foreground">
          Find cash already inside your business, then stop it from getting stuck again. Starts from
          imported cash movements. Sliders below are illustrative scenarios.
        </p>
      </div>

      {/* STEP 1 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent font-bold text-accent-foreground">
            1
          </span>
          <div>
            <h2 className="text-xl font-bold">Unlock hidden cash</h2>
            <p className="text-sm text-muted-foreground">Quick cash this week — no loan needed.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="space-y-3">
            <h3 className="font-semibold">📦 Sell slow stock</h3>
            <p className="text-xs text-muted-foreground">Your stock: {fmt(data.stock)}</p>
            <Slider
              label="Slow-moving share"
              value={deadPct}
              set={setDeadPct}
              min={0}
              max={80}
              unit="%"
            />
            <Slider
              label="Discount to clear"
              value={discount}
              set={setDiscount}
              min={0}
              max={50}
              unit="%"
            />
            <p className="rounded-lg bg-secondary p-2 text-sm font-bold text-success">
              + {fmt(stockCash)}
            </p>
          </Card>
          <Card className="space-y-3">
            <h3 className="font-semibold">🧾 Collect B2B debts</h3>
            <Slider
              label="Unpaid by business customers"
              value={receivable}
              set={setReceivable}
              min={0}
              max={15000}
              unit=" K"
            />
            <Slider
              label="Collect this week"
              value={collectPct}
              set={setCollectPct}
              min={0}
              max={100}
              unit="%"
            />
            <p className="rounded-lg bg-secondary p-2 text-sm font-bold text-success">
              + {fmt(debtCash)}
            </p>
          </Card>
          <Card className="space-y-2">
            <h3 className="font-semibold">✂ Pause extra spending</h3>
            {expenses.map((e) => (
              <label key={e.n} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={frozen.includes(e.n)}
                    onChange={() =>
                      setFrozen(
                        frozen.includes(e.n) ? frozen.filter((x) => x !== e.n) : [...frozen, e.n],
                      )
                    }
                  />
                  {e.n}
                </span>
                <span className="text-muted-foreground">{e.v}</span>
              </label>
            ))}
            <p className="rounded-lg bg-secondary p-2 text-sm font-bold text-success">
              + {fmt(saved)} / month
            </p>
          </Card>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary p-5 text-primary-foreground">
          <div>
            <p className="text-sm opacity-90">💰 Total cash unlocked</p>
            <p className="font-display text-3xl font-bold">+ {fmt(unlocked)}</p>
          </div>
          <p className="text-sm">
            ≈ <b className="text-lg">{weeks}</b> extra weeks of running costs covered
          </p>
        </div>
      </section>

      {/* STEP 2 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent font-bold text-accent-foreground">
            2
          </span>
          <div>
            <h2 className="text-xl font-bold">Cash gap simulator</h2>
            <p className="text-sm text-muted-foreground">
              How many days your money is stuck between paying suppliers and getting paid.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-4">
            <div>
              <div className="flex justify-between text-sm font-medium">
                <span>B2C (pay now) {100 - b2b}%</span>
                <span>B2B (pay later) {b2b}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={b2b}
                onChange={(e) => setB2b(+e.target.value)}
                className="mt-1 w-full accent-primary"
              />
              <p className="text-xs text-muted-foreground">
                Shop customers pay immediately; business customers often pay later.
              </p>
            </div>
            {b2b > 0 && (
              <Slider
                label="B2B customers pay after"
                value={b2bDays}
                set={setB2bDays}
                min={0}
                max={60}
                unit=" days"
              />
            )}
            <Slider
              label="Days stock sits before selling"
              value={dio}
              set={setDio}
              min={5}
              max={60}
              unit=" days"
            />
            <Slider
              label="Days supplier gives you to pay"
              value={dpo}
              set={setDpo}
              min={0}
              max={45}
              unit=" days"
            />
            <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
              Gap = stock days ({dio}) + avg. wait for payment ({dso.toFixed(0)}) − supplier days (
              {dpo})
            </p>
          </Card>
          <Card className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Now</p>
                <p className={`font-display text-4xl font-bold ${gapTone(baseGap)}`}>
                  {baseGap}
                  <span className="text-base"> days</span>
                </p>
                <p className="text-xs text-muted-foreground">{fmt(trapped)} stuck</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">After actions</p>
                <p className={`font-display text-4xl font-bold ${gapTone(newGap)}`}>
                  {newGap}
                  <span className="text-base"> days</span>
                </p>
                <p className="text-xs text-muted-foreground">{fmt(newTrapped)} stuck</p>
              </div>
            </div>
            <p className="text-sm font-semibold">Actions to close the gap</p>
            {b2b > 0 && (
              <Toggle
                on={deposit}
                set={setDeposit}
                label="Ask B2B customers for a 60% deposit"
                effect={`−${Math.round((b2b / 100) * b2bDays * 0.6)} days`}
              />
            )}
            <Toggle
              on={fastStock}
              set={setFastStock}
              label="Restock only fast-selling items"
              effect={`−${dio - Math.max(5, dio - 10)} days`}
            />
            <Toggle
              on={supplier}
              set={setSupplier}
              label="Ask supplier for 15 more days to pay"
              effect="−15 days"
            />
            <div
              className={`rounded-lg p-3 text-sm font-medium ${newGap === 0 ? "bg-secondary text-success" : "bg-muted"}`}
            >
              {newGap === 0
                ? "🎉 Zero gap! Customer money now pays your suppliers — no loan needed."
                : `You still need ${fmt(newTrapped)} of your own cash to cover ${newGap} days. Try more actions.`}
            </div>
          </Card>
        </div>
      </section>

      {/* STEP 3 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent font-bold text-accent-foreground">
            3
          </span>
          <div>
            <h2 className="text-xl font-bold">Build your safety reserve</h2>
            <p className="text-sm text-muted-foreground">
              Goal: 3 months of costs saved, then get credit-ready.
            </p>
          </div>
        </div>
        <Card className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Target reserve</p>
              <p className="font-display text-xl font-bold">{fmt(reserve)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Save per month (30% of profit)</p>
              <p className="font-display text-xl font-bold text-success">{fmt(save)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Months to reach target</p>
              <p className="font-display text-xl font-bold">{String(months)}</p>
            </div>
          </div>
          <div className="h-3 rounded-full bg-muted">
            <div className="h-3 rounded-full bg-success" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            Starting from cash on hand + unlocked cash: {fmt(startCash)} ({progress}%)
          </p>
          <div className="grid gap-2 text-sm sm:grid-cols-4">
            {[
              "Week 1–2: Unlock hidden cash",
              "Month 1: Close the cash gap",
              "Month 2–3: Save into reserve",
              "Month 4+: Start credit checklist",
            ].map((s) => (
              <div key={s} className="rounded-lg bg-muted p-2">
                {s}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <button
        onClick={goCredit}
        className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground"
      >
        Go to Credit Checklist →
      </button>
    </div>
  );
}

const checklist = [
  {
    group: "Legal",
    items: [
      "Business registration certificate (DICA / MyCO)",
      "Trade / municipal license",
      "Owner NRC copy",
      "Tax registration (TIN)",
    ],
  },
  {
    group: "Financial",
    items: [
      "6–12 months bank statements",
      "Income statement (profit & loss)",
      "Balance sheet",
      "Cash in / cash out records (export from BizFlow)",
    ],
  },
  {
    group: "Business",
    items: [
      "Simple business plan",
      "Loan purpose & amount",
      "List of key customers & suppliers",
      "Photos of shop / stock",
    ],
  },
  {
    group: "Security",
    items: [
      "Collateral documents (land, property, vehicle)",
      "Guarantor information",
      "Household registration list",
    ],
  },
];

export function Checklist() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const total = checklist.reduce((a, g) => a + g.items.length, 0);
  const count = Object.values(done).filter(Boolean).length;
  const pct = Math.round((count / total) * 100);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Credit application checklist</h1>
        <p className="text-muted-foreground">
          Prepare everything banks and lenders usually ask for.
        </p>
      </div>
      <Card>
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>Credit readiness</span>
          <span>
            {count}/{total} · {pct}%
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {pct < 40
            ? "Getting started — focus on legal documents first."
            : pct < 80
              ? "Good progress — finish financial records next."
              : "You're ready to apply! 🎉"}
        </p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {checklist.map((g, gi) => (
          <Card key={g.group}>
            <h3 className="mb-3 font-semibold">
              Step {gi + 1}: {g.group}
            </h3>
            <div className="space-y-2">
              {g.items.map((it) => (
                <label
                  key={it}
                  className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={!!done[it]}
                    onChange={(e) => setDone({ ...done, [it]: e.target.checked })}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span
                    className={`text-sm ${done[it] ? "text-muted-foreground line-through" : ""}`}
                  >
                    {it}
                  </span>
                </label>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
