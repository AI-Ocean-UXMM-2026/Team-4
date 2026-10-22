import { expect, it } from "vitest";
import { estimatedFinalPaymentDate, recordedSchedule, type RecordedBalance } from "../recordedSchedule";
const balance: RecordedBalance = {id:"1",lender_kind:"individual",lender_name:"Person",as_of_date:"2026-10-23",outstanding_principal_mmk:"2000000",next_payment_date:"2027-01-31",next_payment_mmk:"177698",annual_rate_pct:"12",remaining_term_months:12,payment_frequency:"monthly"};
it("counts the next installment as the first and clamps the final month", () => {
  expect(estimatedFinalPaymentDate({...balance,remaining_term_months:2})).toBe("2027-02-28");
  expect(estimatedFinalPaymentDate({...balance,remaining_term_months:1})).toBe("2027-01-31");
  expect(estimatedFinalPaymentDate({...balance,payment_frequency:"weekly"})).toBeNull();
});
it("clamps month ends without drifting later due dates", () => {
  const rows = recordedSchedule(balance)!;
  expect(rows[1]!.date).toBe("2027-02-28");
  expect(rows[2]!.date).toBe("2027-03-31");
  expect(rows[0]!.interest).toBe(20000);
  expect(rows[0]!.principal).toBe(157698);
});
it("retains residual debt instead of inventing a balloon payment", () => {
  const rows = recordedSchedule({...balance,next_payment_mmk:"20200"})!;
  expect(rows).toHaveLength(12);
  expect(rows[11]!.outstanding).toBeGreaterThan(1900000);
  expect(rows[11]!.payment).toBe(20200);
});
it("does not invent schedules for unsupported or missing terms", () => {
  expect(recordedSchedule({...balance,payment_frequency:"weekly"})).toBeNull();
  expect(recordedSchedule({...balance,annual_rate_pct:null})).toBeNull();
});

it("excludes fees from principal repayment and rejects unsupported arrangements", () => {
  const terms = {rate_period:"monthly" as const, entered_rate_pct:"1", interest_method:"reducing_balance" as const, regular_payment_mmk:"177698", next_payment_fees_mmk:"5000", balloon_payment_mmk:"0", grace_months:0};
  expect(recordedSchedule({...balance,next_payment_mmk:"182698",repayment_terms:terms})![0]!.principal).toBe(157698);
  expect(recordedSchedule({...balance,repayment_terms:{...terms,interest_method:"flat"}})).toBeNull();
  expect(recordedSchedule({...balance,repayment_terms:{...terms,interest_method:"interest_only"}})).toBeNull();
  expect(recordedSchedule({...balance,repayment_terms:{...terms,balloon_payment_mmk:"100000"}})).toBeNull();
  expect(recordedSchedule({...balance,repayment_terms:{...terms,grace_months:2}})).not.toBeNull();
});
