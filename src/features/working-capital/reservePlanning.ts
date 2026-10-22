import type { ManualWorkingCapitalInputs } from "./manualInputs";

export type ReservePlanResult = {
  status: "projected";
  target_mmk: string;
  dedicated_reserve_mmk: string;
  shortfall_mmk: string;
  affordable_monthly_contribution_mmk: string;
  months_to_target: number | null;
  warning: string;
};

function cents(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  return match ? BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0")) : null;
}

function mmk(value: bigint): string {
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}

export function calculateReservePlan(
  inputs: ManualWorkingCapitalInputs | null,
  months: number,
  monthlyContribution: number,
): ReservePlanResult | null {
  if (!inputs || !Number.isInteger(months) || months < 1 || months > 6 || monthlyContribution < 0)
    return null;
  const costs = cents(inputs.monthlyEssentialCostsMmk || inputs.mandatoryMonthlyPaymentsMmk);
  const protectedTarget = cents(inputs.protectedReserveMmk);
  const dedicated = cents(inputs.dedicatedReserveMmk);
  const contribution = cents(String(monthlyContribution));
  if (costs === null || protectedTarget === null || dedicated === null || contribution === null)
    return null;
  const coverageTarget = costs * BigInt(months);
  const target = protectedTarget > coverageTarget ? protectedTarget : coverageTarget;
  const shortfall = target > dedicated ? target - dedicated : 0n;
  const monthsToTarget =
    shortfall === 0n
      ? 0
      : contribution === 0n
        ? null
        : Number((shortfall + contribution - 1n) / contribution);
  return {
    status: "projected",
    target_mmk: mmk(target),
    dedicated_reserve_mmk: mmk(dedicated),
    shortfall_mmk: mmk(shortfall),
    affordable_monthly_contribution_mmk: mmk(contribution),
    months_to_target: monthsToTarget,
    warning:
      "This is a milestone plan, not a promise. Total cash and projected receipts are not a dedicated reserve.",
  };
}
