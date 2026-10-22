import { useTranslation } from "@/lib/i18n";
import { formatMmk } from "@/features/financial/types";
import { useRef, useState } from "react";
import type { ManualWorkingCapitalInputs } from "../manualInputs";
import { calculateReservePlan } from "../reservePlanning";
import { RangeField, ScenarioResult } from "./ScenarioUI";

type Response = { result: Record<string, unknown> };

function sameMmk(actual: unknown, expected: string): boolean {
  const cents = (value: unknown) => {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
    return match ? BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0")) : null;
  };
  const first = cents(actual);
  return first !== null && first === cents(expected);
}

export function ReservePlanner({
  planReserve,
  inputs,
}: {
  planReserve: <T>(payload: Record<string, unknown>) => Promise<T>;
  inputs: ManualWorkingCapitalInputs | null;
}) {
  const { t } = useTranslation();

  const [months, setMonths] = useState(3);
  const [contribution, setContribution] = useState(100000);
  const [open, setOpen] = useState(false);
  const [verifiedKey, setVerifiedKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const essentialCosts = inputs?.monthlyEssentialCostsMmk || inputs?.mandatoryMonthlyPaymentsMmk;
  const localResult = calculateReservePlan(inputs, months, contribution);
  const key = [
    essentialCosts,
    inputs?.protectedReserveMmk,
    inputs?.dedicatedReserveMmk,
    months,
    contribution,
  ].join(":");
  const response = localResult ? { result: localResult } : null;

  async function run() {
    if (!inputs || !essentialCosts || !localResult) return;
    const currentRequest = ++requestId.current;
    setPending(true);
    setError(null);
    try {
      const result = await planReserve<Response>({
        monthly_essential_costs_mmk: essentialCosts,
        dedicated_reserve_mmk: inputs.dedicatedReserveMmk,
        protected_reserve_target_mmk: inputs.protectedReserveMmk,
        target_months: months,
        monthly_contribution_mmk: contribution,
      });
      if (currentRequest !== requestId.current) return;
      if (
        !sameMmk(result.result["target_mmk"], localResult.target_mmk) ||
        !sameMmk(result.result["shortfall_mmk"], localResult.shortfall_mmk)
      ) {
        setVerifiedKey(null);
        setError("The calculation service is out of date. Restart the backend and try again.");
      } else {
        setVerifiedKey(key);
      }
    } catch (cause) {
      if (currentRequest !== requestId.current) return;
      setError(cause instanceof Error ? cause.message : "Could not calculate the reserve plan.");
    } finally {
      if (currentRequest === requestId.current) setPending(false);
    }
  }

  function togglePlan() {
    if (open) {
      requestId.current += 1;
      setOpen(false);
      setPending(false);
      setError(null);
      setVerifiedKey(null);
      return;
    }
    if (!localResult) return;
    setOpen(true);
    void run();
  }

  return (
    <section className="bf-card space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">{t("Step 3")}</p>
        <h2 className="mt-1 text-xl font-bold">{t("Build a safety reserve")}</h2>
        {inputs ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("Monthly essential costs")}: {formatMmk(essentialCosts ?? null)} ·{" "}
              {t("Current dedicated reserve")}: {formatMmk(inputs.dedicatedReserveMmk)} ·{" "}
              {t("Protected cash reserve target")}: {formatMmk(inputs.protectedReserveMmk)}.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                "Reserve target is the higher of your protected target and monthly essential costs × target coverage. Mandatory payments are included in essential costs; total cash is not a dedicated reserve.",
              )}
            </p>
            <p className="mt-1 text-xs text-primary">{t("Source: Manual Entry")}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              "Enter monthly essential costs, a protected reserve target, and the amount already set aside in Manual Input above to see a reserve plan.",
            )}
          </p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <RangeField
          label={t("Target coverage")}
          value={months}
          min={1}
          max={6}
          unit=" months"
          onChange={setMonths}
        />
        <RangeField
          label={t("Monthly contribution")}
          value={contribution}
          min={0}
          max={1000000}
          step={10000}
          unit=" MMK"
          onChange={setContribution}
        />
      </div>
      <button
        className="bf-button"
        type="button"
        disabled={!localResult}
        aria-expanded={open}
        aria-controls="reserve-projected-result"
        onClick={togglePlan}
      >
        {open ? t("Hide plan") : t("Plan reserve milestones")}
      </button>
      {open && (
        <div
          id="reserve-projected-result"
          role="region"
          aria-label={t("Projected result")}
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          {pending && (
            <p className="text-xs text-muted-foreground">{t("Checking calculation service…")}</p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {t(error)}
            </p>
          )}
          {verifiedKey === key && !error && (
            <p className="text-xs text-primary">{t("Calculation service verified this plan.")}</p>
          )}
          <ScenarioResult response={response} />
        </div>
      )}
    </section>
  );
}
