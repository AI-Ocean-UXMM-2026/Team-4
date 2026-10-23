import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { useTranslation } from "@/lib/i18n";
import type { CreditSummary } from "../types";
import { estimatedFinalPaymentDate } from "../recordedSchedule";
import { RecordedPaymentTable } from "./RecordedPaymentTable";

type Balance = NonNullable<CreditSummary["recorded_balances"]>[number];

export function NextPaymentForm({
  businessId,
  balance,
  asOf,
  editable = false,
  onSaved,
  onClose,
}: {
  businessId: string;
  balance: Balance;
  asOf: string;
  editable?: boolean;
  onSaved?: () => void;
  onClose?: () => void;
}) {
  const { language } = useTranslation();
  const copy = (en: string, my: string) => (language === "my" ? my : en);
  const cache = useQueryClient();
  const [formOpen, setFormOpen] = useState(editable);
  const [date, setDate] = useState(balance.next_payment_date || "");
  const [amount, setAmount] = useState(
    balance.repayment_terms?.regular_payment_mmk || balance.next_payment_mmk || "",
  );
  const [frequency, setFrequency] = useState(balance.payment_frequency || "monthly");
  const [annualRate, setAnnualRate] = useState(
    balance.repayment_terms?.entered_rate_pct || balance.annual_rate_pct || "",
  );
  const [remainingTerm, setRemainingTerm] = useState(
    balance.remaining_term_months?.toString() || "",
  );
  const [principal, setPrincipal] = useState(balance.outstanding_principal_mmk);
  const [balanceDate, setBalanceDate] = useState(balance.as_of_date);
  const [ratePeriod, setRatePeriod] = useState(balance.repayment_terms?.rate_period || "annual");
  const [method, setMethod] = useState(balance.repayment_terms?.interest_method || "");
  const [fees, setFees] = useState(balance.repayment_terms?.next_payment_fees_mmk || "0");
  const [balloon, setBalloon] = useState(balance.repayment_terms?.balloon_payment_mmk || "0");
  const [grace, setGrace] = useState(String(balance.repayment_terms?.grace_months ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedPayment, setSavedPayment] = useState<Balance | null>(null);
  balance = savedPayment || balance;
  const finalPaymentDate = estimatedFinalPaymentDate(balance);
  const field = "mt-2 block min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm";
  const days = balance.next_payment_date
    ? Math.round((Date.parse(balance.next_payment_date) - Date.parse(asOf.slice(0, 10))) / 86400000)
    : null;
  const countdownProgress = days == null ? 0 : Math.max(0, Math.min(100, (days / 31) * 100));
  const nextPaymentTotal = Number(balance.next_payment_mmk) + Number(balance.repayment_terms?.next_payment_fees_mmk || 0);
  const formatDate = (value: string) => value.slice(5, 7) + "/" + value.slice(8, 10) + "/" + value.slice(0, 4);
  const frequencies = [
    ["monthly", copy("Monthly", "လစဉ်")],
    ["biweekly", copy("Every two weeks", "နှစ်ပတ်တစ်ကြိမ်")],
    ["weekly", copy("Weekly", "အပတ်စဉ်")],
    ["one_time", copy("One-time payment", "တစ်ကြိမ်တည်း")],
    ["other", copy("Other arrangement", "အခြားအစီအစဉ်")],
  ];
  return (
    <section className="space-y-4">
      {!editable && balance.next_payment_date && balance.next_payment_mmk && (
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{copy("Recorded next payment", "မှတ်တမ်းတင်ထားသော နောက်အရစ်ကျ")}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                {nextPaymentTotal.toLocaleString("en-US")} <span className="text-sm font-medium text-muted-foreground">{copy("MMK", "ကျပ်")}</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{formatDate(balance.next_payment_date)} (MM/DD/YYYY)</p>
              {balance.annual_rate_pct != null && <span className="sr-only">{Number(balance.annual_rate_pct)}%</span>}
            </div>
            <div className="relative mx-auto grid h-28 w-28 shrink-0 place-items-center sm:mx-0">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
                <circle cx="56" cy="56" r="47" fill="none" stroke="currentColor" strokeWidth="7" className="text-border" />
                <circle
                  cx="56"
                  cy="56"
                  r="47"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="7"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray="100"
                  strokeDashoffset={100 - countdownProgress}
                  className={days !== null && days < 0 ? "text-destructive" : "text-primary"}
                />
              </svg>
              <div className="text-center">
                <span className="block text-2xl font-semibold leading-none">{Math.abs(days || 0)}</span>
                <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {days === 0 ? copy("today", "ယနေ့") : days !== null && days < 0 ? copy("days late", "ရက်ကျော်") : copy("days left", "ရက်ကျန်")}
                </span>
              </div>
              <span className="sr-only">
                {days === 0
                  ? copy("Due today", "ယနေ့ပေးရန်")
                  : days !== null && days > 0
                    ? copy(`${days} days remaining`, `ပေးရန် ${days} ရက် ကျန်ပါသည်`)
                    : copy(
                        `${Math.abs(days || 0)} days past the recorded date — review payment status`,
                        `မှတ်တမ်းတင်ရက်ထက် ${Math.abs(days || 0)} ရက် ကျော်လွန်နေပါသည်။ ပေးချေမှုအခြေအနေကို စစ်ဆေးပါ။`,
                      )}
              </span>
            </div>
          </div>
          <div className="grid border-t border-border sm:grid-cols-3">
            {([
              [copy("Recorded", "မှတ်တမ်းတင်"), formatDate(balance.as_of_date)],
              [copy("Next due", "နောက်ပေးရန်"), formatDate(balance.next_payment_date)],
              [copy("Final due (estimated)", "နောက်ဆုံးပေးရန် (ခန့်မှန်း)"), finalPaymentDate ? formatDate(finalPaymentDate) : "—"],
            ] as const).map(([label, value]) => (
              <div className="border-b border-border px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:px-6" key={label}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
          {balance.repayment_terms && (
            <div className="grid border-t border-border px-5 py-2 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
              {([
                [copy("Interest rate", "အတိုးနှုန်း"), String(balance.repayment_terms.entered_rate_pct) + "% " + (balance.repayment_terms.rate_period === "monthly" ? copy("monthly", "လစဉ်") : copy("annually", "နှစ်စဉ်"))],
                [copy("Interest method", "အတိုးတွက်နည်း"),
                  ({
                    reducing_balance: copy("Reducing balance", "ကျန်အရင်းပေါ်တွက်ခြင်း"),
                    flat: copy("Flat rate", "မူလအရင်းပေါ် အတိုးပုံသေ"),
                    interest_only: copy("Interest only", "အတိုးသာဆပ်ခြင်း"),
                    other: copy("Other / unsure", "အခြား / မသေချာပါ"),
                  } as Record<string, string>)[balance.repayment_terms.interest_method]],
                [copy("Regular instalment", "ပုံမှန်အရစ်ကျ"), Number(balance.repayment_terms.regular_payment_mmk).toLocaleString("en-US") + " " + copy("MMK", "ကျပ်")],
                [copy("Fees", "အခကြေးငွေ"), Number(balance.repayment_terms.next_payment_fees_mmk).toLocaleString("en-US") + " " + copy("MMK", "ကျပ်")],
                [copy("Final lump sum", "နောက်ဆုံးတစ်ကြိမ်တည်းဆပ်ရန်"), Number(balance.repayment_terms.balloon_payment_mmk).toLocaleString("en-US") + " " + copy("MMK", "ကျပ်")],
                [copy("Grace period", "ဆိုင်းငံ့ကာလ"), String(balance.repayment_terms.grace_months) + " " + copy("months", "လ")],
              ] as const).map(([label, value]) => (
                <div className="min-w-0 border-b border-border/70 py-4 last:border-b-0 sm:odd:pr-5 sm:even:pl-5 lg:px-5 lg:first:pl-0 lg:nth-[3n+1]:pl-0 lg:nth-[3n]:pr-0" key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 truncate text-sm font-medium" title={String(value)}>{value}</p>
                </div>
              ))}
            </div>
          )}
          {balance.remaining_term_months != null && (
            <div className="flex items-center justify-between border-t border-border px-5 py-4 text-sm sm:px-6">
              <span className="text-muted-foreground">{copy("Remaining term", "ပြန်ဆပ်ရန်ကျန်ရှိသောကာလ")}</span>
              <span className="font-semibold">{String(balance.remaining_term_months) + " " + copy("months", "လ")}</span>
            </div>
          )}
        </div>
      )}
      <details open={formOpen} onToggle={event => setFormOpen(event.currentTarget.open)}>
          <summary
            className={
              editable
                ? "hidden"
                : "bf-button-secondary inline-flex cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden"
            }
          >
            {balance.next_payment_date
              ? copy("Edit next payment", "နောက်အရစ်ကျ အချက်အလက်ပြင်ရန်")
              : copy(
                  "Add next payment to view repayment table",
                  "ပြန်ဆပ်မှုဇယားကြည့်ရန် နောက်အရစ်ကျ ထည့်ပါ",
                )}
          </summary>
          <form
            className="mt-4 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              setSaved(false);
              try {
                const payload = {
                  outstanding_principal_mmk: principal,
                  as_of_date: balanceDate,
                  repayment_terms: {
                    rate_period: ratePeriod,
                    entered_rate_pct: annualRate,
                    interest_method: method,
                    regular_payment_mmk: amount,
                    next_payment_fees_mmk: fees,
                    balloon_payment_mmk: balloon,
                    grace_months: Number(grace),
                  },
                  annual_rate_pct: (
                    Number(annualRate) * (ratePeriod === "monthly" ? 12 : 1)
                  ).toFixed(3),
                  remaining_term_months: Number(remainingTerm),
                  next_payment_date: date,
                  next_payment_mmk: String(Math.round((Number(amount) + Number(fees)) * 100) / 100),
                  payment_frequency: frequency,
                };
                let stored = await api<Balance>(
                  `/api/v1/credit/recorded-balances/${encodeURIComponent(balance.id)}/next-payment?business_id=${encodeURIComponent(businessId)}`,
                  { method: "PUT", body: JSON.stringify(payload) },
                );
                const matches = (item: Balance | undefined): item is Balance => {
                  const numeric = (actual: unknown, expected: unknown) =>
                    actual != null &&
                    Number.isFinite(Number(actual)) &&
                    Math.abs(Number(actual) - Number(expected)) < 0.000001;
                  const terms = item?.repayment_terms;
                  return (
                    !!item &&
                    item.id === balance.id &&
                    numeric(item.annual_rate_pct, payload.annual_rate_pct) &&
                    item.remaining_term_months === payload.remaining_term_months &&
                    item.next_payment_date === payload.next_payment_date &&
                    numeric(item.next_payment_mmk, payload.next_payment_mmk) &&
                    item.payment_frequency === payload.payment_frequency &&
                    numeric(item.outstanding_principal_mmk, payload.outstanding_principal_mmk) &&
                    item.as_of_date === payload.as_of_date &&
                    !!terms &&
                    terms.rate_period === ratePeriod &&
                    terms.interest_method === method &&
                    numeric(terms.entered_rate_pct, annualRate) &&
                    numeric(terms.regular_payment_mmk, amount) &&
                    numeric(terms.next_payment_fees_mmk, fees) &&
                    numeric(terms.balloon_payment_mmk, balloon) &&
                    terms.grace_months === Number(grace)
                  );
                };
                if (!matches(stored)) {
                  const refreshed = await api<CreditSummary>(
                    `/api/v1/credit/summary?business_id=${encodeURIComponent(businessId)}`,
                  );
                  const persisted = refreshed.recorded_balances?.find(
                    (item) => item.id === balance.id,
                  );
                  if (!matches(persisted)) {
                    throw new Error(
                      copy(
                        "Some payment details could not be confirmed as saved. Your entries are still here. Try again; if this continues, the server needs an update to support these fields.",
                        "အရစ်ကျအချက်အလက်အချို့ သိမ်းဆည်းပြီးကြောင်း အတည်မပြုနိုင်ပါ။ ဖြည့်ထားသောအချက်များကို ဆက်ထိန်းထားပါသည်။ ထပ်ကြိုးစားပါ။ ဆက်ဖြစ်နေပါက ဤအချက်များကို သိမ်းနိုင်ရန် ဆာဗာကို အဆင့်မြှင့်ရန် လိုပါသည်။",
                      ),
                    );
                  }
                  stored = persisted;
                }
                setSavedPayment(stored);
                cache.setQueriesData<CreditSummary>(
                  { queryKey: ["credit-summary", businessId] },
                  (previous) =>
                    previous
                      ? {
                          ...previous,
                          recorded_balances: (previous.recorded_balances ?? []).map((item) =>
                            item.id === stored.id ? stored : item,
                          ),
                        }
                      : previous,
                );
                setSaved(true);
                await cache.invalidateQueries({ queryKey: ["credit-summary", businessId] });
                setFormOpen(false);
                onSaved?.();
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : copy("Could not save payment.", "သိမ်းဆည်း၍ မရပါ။"),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy} className="space-y-4">
              <div>
                <h3 className="font-semibold">{copy("Loan terms", "ချေးငွေစည်းကမ်းချက်များ")}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy(
                    "Use the terms in your signed agreement. Published product rates are guidance only.",
                    "လက်မှတ်ထိုးထားသော စာချုပ်ပါအချက်များကို အသုံးပြုပါ။ ထုတ်ပြန်ထားသော product နှုန်းထားသည် လမ်းညွှန်ချက်သာဖြစ်ပါသည်။",
                  )}
                </p>
              </div>
              <label className="block text-sm font-semibold">
                {copy("Outstanding principal (MMK)", "လက်ရှိကျန်အရင်း (ကျပ်)")}
                <input
                  className={field}
                  type="number"
                  required
                  min="0.01"
                  max="999999999999"
                  step="0.01"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold">
                {copy("Balance recorded on", "လက်ကျန်မှတ်တမ်းတင်ရက်")}
                <input
                  className={field}
                  type="date"
                  required
                  max={asOf.slice(0, 10)}
                  value={balanceDate}
                  onChange={(e) => setBalanceDate(e.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold">
                {copy("Interest rate period", "အတိုးနှုန်းကာလ")}
                <select
                  className={field}
                  value={ratePeriod}
                  onChange={(e) => setRatePeriod(e.target.value as "annual" | "monthly")}
                >
                  <option value="annual">{copy("Annual rate", "နှစ်စဉ်နှုန်း")}</option>
                  <option value="monthly">{copy("Monthly rate", "လစဉ်နှုန်း")}</option>
                </select>
              </label>
              <label className="block text-sm font-semibold">
                {copy("Interest calculation method", "အတိုးတွက်နည်း")}
                <select
                  required
                  className={field}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="">
                    {copy("Select the method in your agreement", "စာချုပ်ပါ အတိုးတွက်နည်း ရွေးပါ")}
                  </option>
                  <option value="reducing_balance">
                    {copy("Reducing balance", "ကျန်အရင်းပေါ် အတိုးတွက်ခြင်း")}
                  </option>
                  <option value="flat">
                    {copy("Flat rate on original principal", "မူလအရင်းပေါ် အတိုးပုံသေတွက်ခြင်း")}
                  </option>
                  <option value="interest_only">{copy("Interest only", "အတိုးသာဆပ်ခြင်း")}</option>
                  <option value="other">{copy("Other / unsure", "အခြား / မသေချာပါ")}</option>
                </select>
              </label>
              <label htmlFor={`annual-rate-${balance.id}`} className="block text-sm font-semibold">
                {copy(
                  "1. What is the agreed interest rate?",
                  "၁။ စာချုပ်ပါ အတိုးနှုန်း ဘယ်လောက်ပါလဲ။",
                )}
                <div className="relative">
                  <input
                    id={`annual-rate-${balance.id}`}
                    className={`${field} pr-10`}
                    type="number"
                    required
                    min="0"
                    max={ratePeriod === "monthly" ? "83.333" : "1000"}
                    step="0.001"
                    value={annualRate}
                    onChange={(event) => setAnnualRate(event.target.value)}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
              </label>
              <label
                htmlFor={`remaining-term-${balance.id}`}
                className="block text-sm font-semibold"
              >
                {copy(
                  "2. How many months remain? (Required)",
                  "၂။ ပြန်ဆပ်ရန်ကျန်ရှိသော ကာလ ဘယ်လောက်ပါလဲ။ (မဖြစ်မနေ ဖြည့်ရန်)",
                )}
                <input
                  id={`remaining-term-${balance.id}`}
                  className={field}
                  type="number"
                  required
                  min="1"
                  max="1200"
                  step="1"
                  placeholder={copy("Enter remaining months", "ကျန်လအရေအတွက် ဖြည့်ပါ")}
                  value={remainingTerm}
                  onChange={(event) => setRemainingTerm(event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold">
                {copy("3. How often are payments due?", "၃။ မည်သည့်အကြိမ်ရေဖြင့် ပေးချေရပါသနည်း။")}
                <select
                  className={field}
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value)}
                >
                  {frequencies.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="border-t pt-4">
                <h3 className="font-semibold">{copy("Next payment", "နောက်အရစ်ကျ")}</h3>
              </div>
              <label className="block text-sm font-semibold">
                {copy(
                  "4. When is your next payment due?",
                  "၄။ နောက်အရစ်ကျကို မည်သည့်ရက်တွင် ပေးချေရမည်နည်း။",
                )}
                <input
                  className={field}
                  type="date"
                  required
                  min={balanceDate}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold">
                {copy(
                  "5. Regular instalment excluding fees (MMK)",
                  "၅။ အခကြေးငွေမပါ ပုံမှန်အရစ်ကျပေးငွေ (ကျပ်)",
                )}
                <input
                  className={field}
                  type="number"
                  required
                  min="0.01"
                  max="999999999999"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
                <span className="mt-2 block font-normal text-muted-foreground">
                  {copy(
                    "Include principal and interest. Enter next-payment fees separately below.",
                    "အရင်းနှင့် အတိုးကိုသာ ပေါင်းထည့်ပါ။ နောက်အရစ်ကျအခကြေးငွေကို အောက်တွင် သီးခြားဖြည့်ပါ။",
                  )}
                </span>
              </label>
              <label className="block text-sm font-semibold">
                {copy(
                  "Next-payment fees (MMK; 0 if none)",
                  "နောက်အရစ်ကျ အခကြေးငွေ (မရှိလျှင် ၀ ကျပ်)",
                )}
                <input
                  className={field}
                  type="number"
                  required
                  min="0"
                  max="999999999999"
                  step="0.01"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold">
                {copy(
                  "Final lump-sum principal (MMK; 0 if none)",
                  "နောက်ဆုံးတစ်ကြိမ်တည်းဆပ်ရန် အရင်း (မရှိလျှင် ၀ ကျပ်)",
                )}
                <input
                  className={field}
                  type="number"
                  required
                  min="0"
                  max={principal}
                  step="0.01"
                  value={balloon}
                  onChange={(e) => setBalloon(e.target.value)}
                />
              </label>
              <label className="block text-sm font-semibold">
                {copy(
                  "Remaining grace period (months; 0 if none)",
                  "ကျန်ဆိုင်းငံ့ကာလ (မရှိလျှင် ၀ လ)",
                )}
                <input
                  className={field}
                  type="number"
                  required
                  min="0"
                  max={remainingTerm || 1200}
                  step="1"
                  value={grace}
                  onChange={(e) => setGrace(e.target.value)}
                />
              </label>
              <p>
                {copy("Total next payment", "နောက်အရစ်ကျ စုစုပေါင်း")}:{" "}
                {(Number(amount) + Number(fees)).toLocaleString("en-US")} {copy("MMK", "ကျပ်")}
              </p>
            </fieldset>
            <p className="text-xs text-muted-foreground">
              {copy(
                "Regular instalment plus next-payment fees is used for cash planning. Monthly reducing-balance loans without a final lump sum receive an estimated schedule. The recorded next-payment date anchors the table, so the grace period does not block it. Other arrangements need the lender’s schedule. Saving does not record an actual payment.",
                "ပုံမှန်အရစ်ကျနှင့် နောက်အရစ်ကျအခကြေးငွေ စုစုပေါင်းကို ငွေလက်ကျန်စီမံရန် သုံးပါမည်။ နောက်ဆုံးတစ်လုံးတည်းပေးငွေ မရှိသော လစဉ်လက်ကျန်လျော့အတိုးအတွက် ခန့်မှန်းဇယား ပြပါမည်။ မှတ်တမ်းတင်ထားသော နောက်အရစ်ကျရက်မှ ဇယားကို စတင်သဖြင့် ဆိုင်းငံ့ကာလသည် ဇယားကို မပိတ်ပင်ပါ။ အခြားအစီအစဉ်များအတွက် ချေးငွေပေးသူ၏ဇယား လိုပါသည်။ သိမ်းခြင်းသည် ပေးချေပြီးဟု မှတ်တမ်းတင်ခြင်း မဟုတ်ပါ။",
              )}
            </p>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
            <button className="bf-button" disabled={busy} type="submit">
              {busy
                ? copy("Saving…", "သိမ်းနေပါသည်…")
                : copy("Save next payment", "နောက်အရစ်ကျ သိမ်းရန်")}
            </button>
            <button className="bf-button-secondary" disabled={busy} type="button" onClick={() => {setFormOpen(false);setError("");onClose?.();}}>{copy("Close", "ပိတ်ရန်")}</button>
            </div>
          </form>
      </details>
      {saved && balance.next_payment_date && (
        <p role="status">{copy("Next payment saved.", "နောက်အရစ်ကျကို သိမ်းဆည်းပြီးပါပြီ။")}</p>
      )}
      <RecordedPaymentTable balance={balance} />
    </section>
  );
}
