import { useTranslation } from "@/lib/i18n";
import { formatMmk } from "@/features/financial/types";
import { useEffect, useId, useRef, useState } from "react";
import type { ManualWorkingCapitalInputs } from "../manualInputs";
import { calculateReservePlan } from "../reservePlanning";
import { RangeField, ScenarioResult } from "./ScenarioUI";

type Response = { result: Record<string, unknown> };
const MAX_CONTRIBUTION_MMK = 1_000_000_000_000n;

function cents(value: unknown): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  return match ? BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0")) : null;
}

function sameMmk(actual: unknown, expected: string): boolean {
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
  const [contributionText, setContributionText] = useState("100000");
  const [open, setOpen] = useState(false);
  const [verifiedKey, setVerifiedKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const requestId = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const contributionId = useId();

  const essentialCosts = inputs?.monthlyEssentialCostsMmk || inputs?.mandatoryMonthlyPaymentsMmk;
  const contributionError =
    contributionText === ""
      ? "Enter a monthly contribution, or 0 if you cannot save yet."
      : !/^\d+$/.test(contributionText)
        ? "Enter a non-negative whole MMK amount."
        : BigInt(contributionText) > MAX_CONTRIBUTION_MMK
          ? "Monthly contribution must be 1,000,000,000,000 MMK or less."
          : null;
  const contribution = contributionError ? null : Number(contributionText);
  const localResult =
    contribution === null ? null : calculateReservePlan(inputs, months, contribution);
  const validationMessage = !inputs
    ? "Enter monthly essential costs and the reserve already saved in the planning inputs above."
    : cents(essentialCosts) === null || cents(essentialCosts) === 0n
      ? "Enter monthly essential costs greater than 0 in the planning inputs above."
      : cents(inputs.dedicatedReserveMmk) === null
        ? "Enter your current dedicated reserve in the planning inputs above. Use 0 if none."
        : cents(inputs.protectedReserveMmk) === null
          ? "Enter a protected reserve target in the planning inputs above. Use 0 if none."
          : !Number.isInteger(months) || months < 1 || months > 6
            ? "Choose target coverage from 1 to 6 months."
            : contributionError
              ? contributionError
              : !localResult
                ? "Check your reserve planning inputs and try again."
                : null;
  const key = [
    essentialCosts,
    inputs?.protectedReserveMmk,
    inputs?.dedicatedReserveMmk,
    months,
    contribution,
  ].join(":");
  const response = localResult && !validationMessage ? { result: localResult } : null;

  useEffect(() => {
    if (open) resultRef.current?.focus();
  }, [open]);

  async function run() {
    if (!inputs || !essentialCosts || !localResult || contribution === null) return;
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
    setAttempted(true);
    if (validationMessage || !localResult) return;
    setOpen(true);
    void run();
  }

  return (
    <section className="bf-card space-y-5">
      <div>
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
              "Enter monthly essential costs, a protected reserve target, and the amount already set aside in the planning inputs above to see a reserve plan.",
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
        <div className="space-y-3 rounded-xl border bg-background p-4">
          <label htmlFor={contributionId} className="block text-sm font-medium text-foreground">
            {t("Monthly contribution")}
          </label>
          <div className="flex min-w-0 items-center gap-3">
            <input
              id={contributionId}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t("Enter amount")}
              value={contributionText}
              onChange={(event) => setContributionText(event.target.value)}
              aria-invalid={contributionError !== null}
              aria-describedby={`${contributionId}-help${contributionError ? ` ${contributionId}-error` : ""}`}
              className="min-w-0 w-full rounded-lg border bg-background px-3 py-2 text-sm font-semibold tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="shrink-0 text-sm font-semibold text-muted-foreground">{t("MMK")}</span>
          </div>
          <p id={`${contributionId}-help`} className="text-xs text-muted-foreground">
            {t("Amount you plan to save each month.")}
          </p>
          {contributionError && (
            <p id={`${contributionId}-error`} role="alert" className="text-xs text-destructive">
              {t(contributionError)}
            </p>
          )}
        </div>
      </div>
      <button
        className="bf-button"
        type="button"
        disabled={contributionError !== null && !open}
        aria-expanded={open}
        aria-controls="reserve-projected-result"
        onClick={togglePlan}
      >
        {open ? t("Hide plan") : t("Plan reserve milestones")}
      </button>
      {attempted && validationMessage && (
        <p role="alert" className="text-sm text-destructive">
          {t(validationMessage)}
        </p>
      )}
      {open && (
        <div
          id="reserve-projected-result"
          ref={resultRef}
          role="region"
          aria-label={t("Projected result")}
          tabIndex={-1}
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 focus:outline-none"
        >
          {localResult && !validationMessage && (
            <p
              role="status"
              className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm font-semibold text-foreground"
            >
              {cents(localResult.shortfall_mmk) === 0n
                ? t("Reserve target already reached.")
                : contribution === 0
                  ? t(
                      "At 0 MMK per month, this target cannot be reached without additional contributions.",
                    )
                  : t("At {0} per month, the target could be reached in about {1} months.", {
                      "0": formatMmk(contribution),
                      "1": String(localResult.months_to_target),
                    })}
            </p>
          )}
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
