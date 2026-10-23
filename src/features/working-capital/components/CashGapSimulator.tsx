import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type { WorkingCapitalSnapshot } from "../hooks/useWorkingCapital";
import { RangeField, ScenarioResult } from "./ScenarioUI";
import { gapChange } from "./cashGapChange";

type Response = { result: Record<string, unknown> };
type Inputs = WorkingCapitalSnapshot["unlock_cash"];
type BusinessModel = "b2c" | "b2b" | "mixed";

function days(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

export function CashGapSimulator({
  simulate,
  inputs,
}: {
  simulate: <T>(type: string, assumptions: Record<string, unknown>) => Promise<T>;
  inputs?: Inputs | undefined;
}) {
  const { t } = useTranslation();
  const [model, setModel] = useState<BusinessModel | null>(null);
  const [b2cPaymentDays, setB2cPaymentDays] = useState(15);
  const [b2bPaymentDays, setB2bPaymentDays] = useState(15);
  const [dio, setDio] = useState(30);
  const [dpo, setDpo] = useState(25);
  const [deposit, setDeposit] = useState(false);
  const [fastStock, setFastStock] = useState(false);
  const [supplierExtension, setSupplierExtension] = useState(false);
  const [results, setResults] = useState<Partial<Record<"b2c" | "b2b", Response>>>({});
  const [checkedScenario, setCheckedScenario] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const afterDio = fastStock ? Math.max(0, dio - 10) : dio;
  const afterDpo = dpo + (supplierExtension ? 15 : 0);
  const activeGroups: ("b2c" | "b2b")[] = model === "mixed" ? ["b2c", "b2b"] : model ? [model] : [];
  const comparisons = activeGroups.map((group) => {
    const paymentDays = group === "b2c" ? b2cPaymentDays : b2bPaymentDays;
    const currentGap = Math.max(0, dio + paymentDays - dpo);
    // A 60% immediate deposit on every delayed sale scales that group's average by 40%.
    const afterWait = deposit ? paymentDays * 0.4 : paymentDays;
    const afterGap = Math.max(0, afterDio + afterWait - afterDpo);
    return {
      group,
      paymentDays,
      currentGap,
      afterWait,
      afterGap,
      change: gapChange(currentGap, afterGap),
    };
  });
  const scenarioKey = [
    model,
    b2cPaymentDays,
    b2bPaymentDays,
    dio,
    dpo,
    deposit,
    fastStock,
    supplierExtension,
  ].join(":");

  async function run() {
    setPending(true);
    setError(null);
    setResults({});
    try {
      const responses = await Promise.all(
        comparisons.map(async ({ group, paymentDays, afterWait }) => ({
          group,
          response: await simulate<Response>("cash_gap", {
            dio_days: dio,
            dso_days: paymentDays,
            dpo_days: dpo,
            proposed_dio_days: afterDio,
            proposed_dso_days: afterWait,
            supplier_extension_days: supplierExtension ? 15 : 0,
            demo_estimate: true,
          }),
        })),
      );
      setResults(Object.fromEntries(responses.map(({ group, response }) => [group, response])));
      setCheckedScenario(scenarioKey);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not calculate this scenario.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="bf-card space-y-5">
      <div>
        <h2 className="mt-1 text-xl font-bold">{t("Explore the cash gap")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "See how stock, customer payment, and supplier timing affect the days your cash is tied up.",
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {inputs?.as_of
            ? t(
                "The imported summary through {0} does not establish a complete timing baseline. Values below are editable scenario assumptions, not recorded facts.",
                { "0": inputs.as_of },
              )
            : t("Values below are editable scenario assumptions, not recorded facts.")}
        </p>
      </div>

      <div aria-labelledby="cash-gap-business-type" className="space-y-3">
        <h3 id="cash-gap-business-type" className="text-base font-semibold">
          {t("What type of business do you operate?")}
        </h3>
        <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-3">
          {(
            [
              {
                value: "b2c",
                label: "B2C — Business to Consumer",
                description: "Retail shops and individual customers",
              },
              {
                value: "b2b",
                label: "B2B — Business to Business",
                description: "Wholesale and sales to other businesses",
              },
              {
                value: "mixed",
                label: "Both — B2B and B2C",
                description: "Sales to both businesses and individual customers",
              },
            ] as const
          ).map((choice) => (
            <button
              key={choice.value}
              type="button"
              aria-pressed={model === choice.value}
              onClick={() => setModel(choice.value)}
              className={`h-full min-w-0 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                model === choice.value
                  ? "border-primary bg-primary/10"
                  : "bg-background hover:border-primary/60 hover:bg-primary/5"
              }`}
            >
              <span className="block font-semibold text-foreground">{t(choice.label)}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t(choice.description)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {model && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-4 rounded-xl border bg-muted/30 p-4 sm:p-5">
            <h3 className="font-semibold">{t("Cash gap inputs")}</h3>
            {(model === "b2c" || model === "mixed") && (
              <div>
                <RangeField
                  label={t("Average B2C customer payment days")}
                  value={b2cPaymentDays}
                  min={0}
                  max={90}
                  unit=" days"
                  onChange={setB2cPaymentDays}
                />
              </div>
            )}
            {(model === "b2b" || model === "mixed") && (
              <div>
                <RangeField
                  label={t("Average B2B customer payment days")}
                  value={b2bPaymentDays}
                  min={0}
                  max={90}
                  unit=" days"
                  onChange={setB2bPaymentDays}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t(
                model === "mixed"
                  ? "Include immediately paid sales as 0 days in each average."
                  : "Include immediately paid sales as 0 days in this average.",
              )}
            </p>
            <RangeField
              label={t("Days stock stays before selling (DIO)")}
              value={dio}
              min={0}
              max={180}
              unit=" days"
              onChange={setDio}
            />
            <RangeField
              label={t("Days before paying suppliers (DPO)")}
              value={dpo}
              min={0}
              max={180}
              unit=" days"
              onChange={setDpo}
            />
          </div>

          <div className="min-w-0 space-y-4 rounded-xl border bg-muted/30 p-4 sm:p-5">
            <h3 className="font-semibold">{t("Now vs after actions")}</h3>
            {model === "mixed" && (
              <p className="text-xs text-muted-foreground">
                {t("No verified sales split; B2C and B2B estimates are shown separately.")}
              </p>
            )}
            {comparisons.map(({ group, currentGap, afterGap, change }) => (
              <section
                key={group}
                aria-label={t(group === "b2c" ? "B2C scenario" : "B2B scenario")}
                className="space-y-2"
              >
                {model === "mixed" && (
                  <h4 className="text-sm font-semibold">
                    {t(group === "b2c" ? "B2C scenario" : "B2B scenario")}
                  </h4>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-xl border bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("Before Changes")}
                    </p>
                    <p className="mt-2 break-words font-display text-3xl font-bold tabular-nums text-primary">
                      {days(currentGap)} <span className="text-base">{t("days")}</span>
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl border bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("After Changes")}
                    </p>
                    <p className="mt-2 break-words font-display text-3xl font-bold tabular-nums text-primary">
                      {days(afterGap)} <span className="text-base">{t("days")}</span>
                    </p>
                  </div>
                </div>
                <p
                  role="status"
                  className={`text-sm font-semibold ${change.kind === "worsened" ? "text-destructive" : "text-primary"}`}
                >
                  {change.kind === "improved"
                    ? t("Potential improvement: {0} fewer days", { "0": days(change.days) })
                    : change.kind === "worsened"
                      ? t("Cash gap worsens by {0} days", { "0": days(change.days) })
                      : t("No change yet")}
                </p>
              </section>
            ))}
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-semibold">
                {t("Ways to reduce your cash gap")}
              </legend>
              <label className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border bg-background p-3 text-sm">
                <input
                  type="checkbox"
                  checked={deposit}
                  onChange={(event) => setDeposit(event.target.checked)}
                  aria-label={t(
                    "What-if: ask every pay-later customer for a 60% deposit immediately",
                  )}
                  className="mt-0.5 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  {t("Ask customers who pay later for a 60% deposit")}
                </span>
                <span className="text-xs font-semibold text-primary">
                  {model === "mixed"
                    ? `B2C −${days(b2cPaymentDays * 0.6)} · B2B −${days(b2bPaymentDays * 0.6)} ${t("wait days")}`
                    : `−${days((model === "b2c" ? b2cPaymentDays : b2bPaymentDays) * 0.6)} ${t("wait days")}`}
                </span>
              </label>
              <label className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border bg-background p-3 text-sm">
                <input
                  type="checkbox"
                  checked={fastStock}
                  onChange={(event) => setFastStock(event.target.checked)}
                  aria-label={t(
                    "What-if: Restock only fast-selling items, reducing stock days by up to 10",
                  )}
                  className="mt-0.5 accent-primary"
                />
                <span className="min-w-0 flex-1">{t("Restock only fast-selling items")}</span>
                <span className="text-xs font-semibold text-primary">
                  −{days(dio - Math.max(0, dio - 10))} {t("stock days")}
                </span>
              </label>
              <label className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border bg-background p-3 text-sm">
                <input
                  type="checkbox"
                  checked={supplierExtension}
                  onChange={(event) => setSupplierExtension(event.target.checked)}
                  aria-label={t("What-if: suppliers agree to 15 more days to pay")}
                  className="mt-0.5 accent-primary"
                />
                <span className="min-w-0 flex-1">{t("Ask suppliers for 15 more days to pay")}</span>
                <span className="text-xs font-semibold text-primary">+15 {t("supplier days")}</span>
              </label>
            </fieldset>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-primary">
                {t("Calculation details")}
              </summary>
              <button className="bf-button mt-3" disabled={pending} onClick={() => void run()}>
                {pending ? t("Comparing…") : t("Check with calculation service")}
              </button>
              {error && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {t(error)}
                </p>
              )}
              {checkedScenario === scenarioKey &&
                comparisons.map(({ group }) => (
                  <div key={group}>
                    {model === "mixed" && (
                      <h4 className="mt-4 font-semibold">
                        {t(group === "b2c" ? "B2C scenario" : "B2B scenario")}
                      </h4>
                    )}
                    <ScenarioResult response={results[group] ?? null} />
                  </div>
                ))}
            </details>
            <p className="text-xs text-muted-foreground">
              {t("Planning estimates only. Your business records do not change.")}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
