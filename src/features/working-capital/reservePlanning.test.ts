import { describe, expect, it } from "vitest";
import { calculateReservePlan } from "./reservePlanning";
import type { ManualWorkingCapitalInputs } from "./manualInputs";

const inputs: ManualWorkingCapitalInputs = {
  availableCashMmk: null,
  supplierLeadDays: 7,
  mandatoryMonthlyPaymentsMmk: "500000",
  monthlyEssentialCostsMmk: "500000",
  protectedReserveMmk: "3000000",
  dedicatedReserveMmk: "300000",
  stockLevels: {},
};

describe("live reserve planning", () => {
  it("uses the protected target instead of a lower coverage target", () => {
    const result = calculateReservePlan(inputs, 3, 100000);
    expect(result?.target_mmk).toBe("3000000.00");
    expect(result?.shortfall_mmk).toBe("2700000.00");
    expect(result?.months_to_target).toBe(27);
  });

  it("raises the target when coverage exceeds the protected floor", () => {
    const result = calculateReservePlan(
      { ...inputs, monthlyEssentialCostsMmk: "700000" },
      6,
      100000,
    );
    expect(result?.target_mmk).toBe("4200000.00");
    expect(result?.shortfall_mmk).toBe("3900000.00");
  });

  it("updates the milestone when the saved reserve or contribution changes", () => {
    expect(
      calculateReservePlan({ ...inputs, dedicatedReserveMmk: "1500000" }, 3, 100000)
        ?.months_to_target,
    ).toBe(15);
    expect(calculateReservePlan(inputs, 3, 0)?.months_to_target).toBeNull();
    expect(calculateReservePlan(null, 3, 100000)).toBeNull();
  });
});
