import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { formatMmk } from "@/features/financial/types";
import type { WorkingCapitalSnapshot } from "../hooks/useWorkingCapital";
import { RangeField } from "./ScenarioUI";

type Inputs = WorkingCapitalSnapshot["unlock_cash"];
const MMK_SCALE = 10_000_000_000n;

function scaledMmk(value: string | number | null | undefined): bigint | null {
  if (value == null || !/^\d+(\.\d{1,10})?$/.test(String(value))) return null;
  const [whole = "0", fraction = ""] = String(value).split(".");
  return BigInt(whole) * MMK_SCALE + BigInt(fraction.padEnd(10, "0"));
}

function formatCashK(amount: bigint | null): string | null {
  if (amount === null) return null;
  if (amount > 0n && amount < 1_000n * MMK_SCALE) return `+ ${formatExactMmk(amount)}`;
  const thousandMmk = 1_000n * MMK_SCALE;
  const thousands = (amount + thousandMmk / 2n) / thousandMmk;
  return `+ ${thousands.toLocaleString("en-US")} K`;
}

function formatExactMmk(amount: bigint | null): string | undefined {
  if (amount === null) return undefined;
  const fraction = (amount % MMK_SCALE).toString().padStart(10, "0").replace(/0+$/, "");
  return formatMmk(`${amount / MMK_SCALE}${fraction ? `.${fraction}` : ""}`);
}

export function UnlockCashSimulator({
  inputs,
  manualStock = false,
}: {
  inputs: Inputs | undefined;
  manualStock?: boolean;
}) {
  const { t } = useTranslation();
  const [slowMovingPct, setSlowMovingPct] = useState(30);
  const [discountPct, setDiscountPct] = useState(20);
  const [collectionPct, setCollectionPct] = useState(50);
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);

  const stockValue = scaledMmk(inputs?.stock_value_mmk);
  const receivables = scaledMmk(inputs?.receivables_mmk);
  const weeklyCost = scaledMmk(inputs?.average_weekly_running_cost_mmk);
  const stockCash =
    stockValue === null
      ? null
      : (stockValue * BigInt(slowMovingPct) * BigInt(100 - discountPct) + 5_000n) / 10_000n;
  const collectionCash =
    receivables === null ? null : (receivables * BigInt(collectionPct) + 50n) / 100n;
  const expenseCash = (inputs?.expense_candidates ?? []).reduce<bigint | null>((total, item) => {
    if (!selectedExpenses.includes(item.expense_id)) return total;
    const amount = scaledMmk(item.amount_mmk);
    return total === null || amount === null ? null : total + amount;
  }, 0n);
  const totalCash =
    stockCash === null || collectionCash === null || expenseCash === null
      ? null
      : stockCash + collectionCash + expenseCash;
  const weeksTenths =
    totalCash === null || weeklyCost === null || weeklyCost <= 0n
      ? null
      : (totalCash * 10n + weeklyCost / 2n) / weeklyCost;
  const weeks = weeksTenths === null ? null : `${weeksTenths / 10n}.${weeksTenths % 10n}`;

  return (
    <section className="bf-card space-y-5">
      <div>
        <h2 className="mt-1 text-xl font-bold">{t("Unlock hidden cash")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "Based on your imported records. Slider results are possible cash relief, not cash already received; your records do not change.",
          )}
        </p>
        {inputs?.as_of && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Recorded through")} {inputs.as_of}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="flex h-full min-h-0 min-w-0 flex-col gap-2.5 rounded-xl border bg-muted/30 p-4">
          <div>
            <h3 className="font-semibold">{t("Discount slow stock")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("Stock at recorded unit cost")}</p>
            {manualStock && (
              <p className="text-xs text-primary">
                {t("Source: Manual Entry")} · {t("Planning stock level")}
              </p>
            )}
            <p className="mt-1 break-words text-base font-semibold tabular-nums">
              {formatMmk(inputs?.stock_value_mmk ?? null)}
            </p>
          </div>
          <div className="space-y-2.5">
            <RangeField
              label={t("Slow-moving share")}
              value={slowMovingPct}
              min={0}
              max={100}
              unit="%"
              onChange={setSlowMovingPct}
            />
            <RangeField
              label={t("Discount")}
              value={discountPct}
              min={0}
              max={70}
              unit="%"
              onChange={setDiscountPct}
            />
            <p className="text-xs text-muted-foreground">
              {t(
                "Estimate applies the discount to recorded unit cost; an actual selling price may differ.",
              )}
            </p>
          </div>
          <p
            className="mt-auto rounded-lg bg-secondary p-2 text-sm font-bold text-success"
            title={formatExactMmk(stockCash)}
            aria-label={stockCash === null ? t("Unavailable") : formatExactMmk(stockCash)}
          >
            {formatCashK(stockCash) ?? t("Unavailable")}
          </p>
        </div>
        <div className="flex h-full min-h-0 min-w-0 flex-col gap-2.5 rounded-xl border bg-muted/30 p-4">
          <div>
            <h3 className="font-semibold">{t("Collect receivables")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("Unpaid customer balances")}</p>
            <p className="mt-1 break-words text-base font-semibold tabular-nums">
              {formatMmk(inputs?.receivables_mmk ?? null)}
            </p>
          </div>
          <div className="space-y-2.5">
            <RangeField
              label={t("Target collection")}
              value={collectionPct}
              min={0}
              max={100}
              unit="%"
              onChange={setCollectionPct}
            />
            <p className="text-xs text-muted-foreground">
              {t("Collection is a target, not a recorded receipt or a guarantee.")}
            </p>
          </div>
          <p
            className="mt-auto rounded-lg bg-secondary p-2 text-sm font-bold text-success"
            title={formatExactMmk(collectionCash)}
            aria-label={collectionCash === null ? t("Unavailable") : formatExactMmk(collectionCash)}
          >
            {formatCashK(collectionCash) ?? t("Unavailable")}
          </p>
        </div>
        <div className="flex h-full min-h-0 min-w-0 flex-col gap-2.5 rounded-xl border bg-muted/30 p-4 md:col-span-2 xl:col-span-1">
          <div>
            <h3 className="font-semibold">{t("Pause optional spending")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                "Choose recent expenses you could avoid if they recur. Past bills remain payable.",
              )}
            </p>
          </div>
          <div
            role="region"
            aria-label={t("Optional expense items")}
            tabIndex={0}
            className="max-h-64 min-h-0 overflow-y-auto overscroll-contain pr-1 touch-pan-y focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] md:max-h-[280px]"
          >
            <div className="space-y-2">
              {inputs?.expense_candidates.length ? (
                inputs.expense_candidates.map((item) => (
                  <label
                    key={item.expense_id}
                    className="flex min-h-12 min-w-0 flex-wrap items-center gap-3 rounded-xl border bg-background p-3 text-sm sm:p-4"
                  >
                    <input
                      type="checkbox"
                      checked={selectedExpenses.includes(item.expense_id)}
                      onChange={() =>
                        setSelectedExpenses((current) =>
                          current.includes(item.expense_id)
                            ? current.filter((id) => id !== item.expense_id)
                            : [...current, item.expense_id],
                        )
                      }
                      className="accent-primary"
                    />
                    <span className="min-w-0 flex-1 break-words">
                      {item.description || item.category}
                    </span>
                    <span className="max-w-full break-all text-xs text-muted-foreground">
                      {formatMmk(item.amount_mmk)}
                    </span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("No recent expense records are available to review.")}
                </p>
              )}
            </div>
          </div>
          <p
            className="mt-auto rounded-lg bg-secondary p-2 text-sm font-bold text-success"
            title={formatExactMmk(expenseCash)}
            aria-label={expenseCash === null ? t("Unavailable") : formatExactMmk(expenseCash)}
          >
            {formatCashK(expenseCash) ?? t("Unavailable")}
          </p>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border bg-muted/50 p-4 sm:grid-cols-2 sm:items-center sm:gap-x-6">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {t("Potential cash unlocked")}
          </p>
          <p className="mt-1 break-words font-display text-2xl font-bold tabular-nums text-primary sm:text-3xl">
            {formatExactMmk(totalCash) ?? t("Unavailable")}
          </p>
        </div>
        <div className="min-w-0 sm:border-l sm:pl-6">
          <p className="text-sm font-medium text-muted-foreground">
            {t("Estimated operating-cost coverage")}
          </p>
          <p className="mt-1 break-words font-display text-xl font-semibold tabular-nums">
            {weeks === null
              ? t("Running-cost coverage unavailable")
              : t("≈ {0} weeks", { "0": weeks })}
          </p>
        </div>
        <p className="border-t pt-3 text-xs text-muted-foreground sm:col-span-2">
          {t("Scenario estimates only. Actual results may differ.")}
        </p>
      </div>
    </section>
  );
}
