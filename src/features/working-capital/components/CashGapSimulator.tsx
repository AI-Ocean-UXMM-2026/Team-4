import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type { WorkingCapitalSnapshot } from "../hooks/useWorkingCapital";
import { RangeField, ScenarioResult } from "./ScenarioUI";

type Response = { result: Record<string, unknown> };
type Inputs = WorkingCapitalSnapshot["unlock_cash"];

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
  const [b2bPct, setB2bPct] = useState(40);
  const [b2bDays, setB2bDays] = useState(30);
  const [dio, setDio] = useState(30);
  const [dpo, setDpo] = useState(25);
  const [deposit, setDeposit] = useState(false);
  const [fastStock, setFastStock] = useState(false);
  const [supplierExtension, setSupplierExtension] = useState(false);
  const [result, setResult] = useState<Response | null>(null);
  const [checkedScenario, setCheckedScenario] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const averageWait = (b2bPct * b2bDays) / 100;
  const currentGap = Math.max(0, dio + averageWait - dpo);
  const afterDio = fastStock ? Math.max(0, dio - 10) : dio;
  const afterWait = (b2bPct * (deposit ? b2bDays * 0.4 : b2bDays)) / 100;
  const afterDpo = dpo + (supplierExtension ? 15 : 0);
  const afterGap = Math.max(0, afterDio + afterWait - afterDpo);
  const improvement = currentGap - afterGap;
  const scenarioKey = [b2bPct, b2bDays, dio, dpo, deposit, fastStock, supplierExtension].join(":");

  async function run() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const response = await simulate<Response>("cash_gap", {
        dio_days: dio,
        dso_days: averageWait,
        dpo_days: dpo,
        proposed_dio_days: afterDio,
        proposed_dso_days: afterWait,
        supplier_extension_days: supplierExtension ? 15 : 0,
        demo_estimate: true,
      });
      setResult(response);
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
        <p className="text-xs font-bold uppercase tracking-wider text-primary">{t("Step 2")}</p>
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

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-4 rounded-xl border bg-muted/30 p-4 sm:p-5">
          <h3 className="font-semibold">{t("Cash gap inputs")}</h3>
          <label className="block space-y-3 rounded-xl border bg-background p-4">
            <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
              <span>
                {t("B2C pay now")}: {100 - b2bPct}%
              </span>
              <span className="font-semibold text-primary">
                {t("B2B pay later")}: {b2bPct}%
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={b2bPct}
              onChange={(event) => setB2bPct(Number(event.target.value))}
              aria-label={t("B2B pay-later share")}
              className="w-full cursor-pointer accent-primary"
            />
            <span className="block text-xs text-muted-foreground">
              {t(
                "This scenario treats pay-later sales as B2B and assumes B2C pays immediately; the workbook does not identify customer type.",
              )}
            </span>
          </label>
          <RangeField
            label={t("B2B customers pay after")}
            value={b2bDays}
            min={0}
            max={90}
            unit=" days"
            onChange={setB2bDays}
          />
          <RangeField
            label={t("Days stock sits before selling (DIO)")}
            value={dio}
            min={0}
            max={180}
            unit=" days"
            onChange={setDio}
          />
          <RangeField
            label={t("Days supplier gives you to pay (DPO)")}
            value={dpo}
            min={0}
            max={180}
            unit=" days"
            onChange={setDpo}
          />
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            {t("Cash gap = Stock days + Average payment waiting days − Supplier payment days")}
            <span className="mt-1 block">
              {t("Average payment waiting days")}: {days(averageWait)} {t("days")} ({b2bPct}% ×{" "}
              {b2bDays} {t("days")}; {t("B2C pays now")}).
            </span>
          </p>
        </div>

        <div className="min-w-0 space-y-4 rounded-xl border bg-muted/30 p-4 sm:p-5">
          <h3 className="font-semibold">{t("Now vs after actions")}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("Now · assumption baseline")}
              </p>
              <p className="mt-2 break-words font-display text-3xl font-bold tabular-nums text-primary">
                {days(currentGap)} <span className="text-base">{t("days")}</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("Estimated cash tied up: Unavailable")}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("After actions · scenario")}
              </p>
              <p className="mt-2 break-words font-display text-3xl font-bold tabular-nums text-primary">
                {days(afterGap)} <span className="text-base">{t("days")}</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("Estimated cash tied up: Unavailable")}
              </p>
              <p className="mt-1 text-xs font-semibold text-success">
                −{days(improvement)} {t("days from baseline")}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              "An MMK estimate needs a dated cash forecast. Recorded operating expenses alone do not include inventory and supplier cash timing.",
            )}{" "}
            {t("A negative formula result is shown as zero gap days.")}
          </p>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">{t("Actions to close the gap")}</legend>
            <label className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border bg-background p-3 text-sm">
              <input
                type="checkbox"
                checked={deposit}
                onChange={(event) => setDeposit(event.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="min-w-0 flex-1">
                {t("Ask pay-later customers for a 60% deposit")}
                <span className="block text-xs text-muted-foreground">
                  {t("Assumes 60% of their payment arrives immediately.")}
                </span>
              </span>
              <span className="text-xs font-semibold text-primary">
                −{days((b2bPct * b2bDays * 0.6) / 100)} {t("wait days")}
              </span>
            </label>
            <label className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border bg-background p-3 text-sm">
              <input
                type="checkbox"
                checked={fastStock}
                onChange={(event) => setFastStock(event.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="min-w-0 flex-1">
                {t("Restock only fast-selling items")}
                <span className="block text-xs text-muted-foreground">
                  {t("Assumes stock days fall by up to 10 days, never below zero.")}
                </span>
              </span>
              <span className="text-xs font-semibold text-primary">
                −{days(dio - Math.max(0, dio - 10))} {t("stock days")}
              </span>
            </label>
            <label className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border bg-background p-3 text-sm">
              <input
                type="checkbox"
                checked={supplierExtension}
                onChange={(event) => setSupplierExtension(event.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="min-w-0 flex-1">
                {t("Ask suppliers for 15 more days to pay")}
                <span className="block text-xs text-muted-foreground">
                  {t("Assumes the supplier agrees to extend payment terms.")}
                </span>
              </span>
              <span className="text-xs font-semibold text-primary">+15 {t("supplier days")}</span>
            </label>
          </fieldset>
          <p
            role="status"
            className="rounded-lg bg-secondary p-3 text-sm font-semibold text-secondary-foreground"
          >
            {improvement > 0
              ? t("Scenario cash gap falls by {0} days.", { "0": days(improvement) })
              : t("Choose an action to see how the scenario changes.")}
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-primary">
              {t("Calculation details")}
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Scenario values are illustrative and do not change your imported records.")}
            </p>
            <button className="bf-button mt-3" disabled={pending} onClick={() => void run()}>
              {pending ? t("Comparing…") : t("Check with calculation service")}
            </button>
            {error && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {t(error)}
              </p>
            )}
            {checkedScenario === scenarioKey && <ScenarioResult response={result} />}
          </details>
        </div>
      </div>
    </section>
  );
}
