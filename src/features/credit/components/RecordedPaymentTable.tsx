import { useTranslation } from "@/lib/i18n";
import { recordedSchedule, type RecordedBalance } from "../recordedSchedule";

export function RecordedPaymentTable({balance}: {balance: RecordedBalance}) {
  const {language} = useTranslation();
  const c = (en:string,my:string) => language === "my" ? my : en;
  const rows = recordedSchedule(balance);
  if (!rows) {
    const reasons: string[] = [];
    if (!balance.next_payment_date) reasons.push(c("Add the next payment date.", "နောက်ပေးချေရမည့် ရက်စွဲကို ဖြည့်ပါ။"));
    if (!balance.next_payment_mmk) reasons.push(c("Add the regular payment amount.", "ပုံမှန်ပေးချေရမည့် ငွေပမာဏကို ဖြည့်ပါ။"));
    if (balance.annual_rate_pct == null) reasons.push(c("Add the agreed interest rate.", "သဘောတူထားသော အတိုးနှုန်းကို ဖြည့်ပါ။"));
    if (!balance.remaining_term_months) reasons.push(c("Add the number of months remaining.", "ကျန်ရှိသော လအရေအတွက်ကို ဖြည့်ပါ။"));
    if (!balance.payment_frequency) reasons.push(c("Select the payment frequency.", "ပေးချေရမည့် အကြိမ်နှုန်းကို ရွေးပါ။"));
    else if (balance.payment_frequency !== "monthly") reasons.push(c("This payment frequency needs the lender’s repayment schedule; only monthly payments can be estimated here.", "ဤပေးချေမှုအကြိမ်နှုန်းအတွက် ချေးငွေပေးသူ၏ ဇယားလိုပါသည်။ ဤနေရာတွင် လစဉ်ပေးချေမှုကိုသာ ခန့်မှန်းနိုင်ပါသည်။"));
    if (balance.repayment_terms && balance.repayment_terms.interest_method !== "reducing_balance") reasons.push(c("This interest method needs the lender’s repayment schedule; only reducing-balance interest can be estimated here.", "ဤအတိုးတွက်နည်းအတွက် ချေးငွေပေးသူ၏ ဇယားလိုပါသည်။ ဤနေရာတွင် လက်ကျန်လျော့အတိုးကိုသာ ခန့်မှန်းနိုင်ပါသည်။"));
    if (Number(balance.repayment_terms?.balloon_payment_mmk) > 0) reasons.push(c("A final lump-sum payment is recorded. Use the lender’s repayment schedule.", "နောက်ဆုံးတစ်လုံးတည်းပေးငွေ ရှိပါသည်။ ချေးငွေပေးသူ၏ ဇယားကို အသုံးပြုပါ။"));
    return <section className="space-y-3 border-t pt-4">
      <h3 className="font-semibold">{c("Payment table unavailable", "ပေးချေမှုဇယား မရရှိနိုင်သေးပါ")}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {reasons.map(reason => <li key={reason}>{reason}</li>)}
      </ul>
      <p className="text-sm text-muted-foreground">{c("Review your saved next-payment details and update any missing information.", "သိမ်းထားသော နောက်ပေးချေမှုအချက်အလက်များကို စစ်ဆေးပြီး လိုအပ်သည်များကို ဖြည့်ပါ။")}</p>
    </section>;
  }
  const money = (n:number) => n.toLocaleString("en-US", {maximumFractionDigits:2});
  const date = (d:string) => `${d.slice(5,7)}/${d.slice(8,10)}/${d.slice(0,4)}`;
  return <details className="border-t pt-4" open>
    <summary className="bf-button inline-flex cursor-pointer list-none [&::-webkit-details-marker]:hidden">{c("View remaining payment table", "ကျန်အရစ်ကျဇယား ကြည့်ရန်")}</summary>
    <div className="mt-4 space-y-3">
      <>
        <div className="max-w-full overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[860px] text-left text-sm">
            <caption className="sr-only">
              {c("Estimated remaining loan payments", "ခန့်မှန်း ကျန်ရှိသော ချေးငွေပေးချေမှုများ")}
            </caption>
            <thead className="bg-muted/70 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                {[c("No.","စဉ်"),c("Date (MM/DD/YYYY)","ရက်စွဲ (MM/DD/YYYY)"),c("Payment (MMK)","ပေးငွေ (ကျပ်)"),c("Principal (MMK)","အရင်း (ကျပ်)"),c("Interest (MMK)","အတိုး (ကျပ်)"),c("Remaining principal (MMK)","ကျန်အရင်း (ကျပ်)")].map((h, index) => (
                  <th
                    className={`px-4 py-4 sm:px-5 ${index >= 2 ? "text-right" : ""}`}
                    key={h}
                    scope="col"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.period} className="border-t border-border transition-colors hover:bg-muted/30">
                  <td className="px-4 py-4 font-medium text-foreground sm:px-5">{row.period}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-medium text-foreground sm:px-5">{date(row.date)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums text-primary sm:px-5">{money(row.payment)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums text-foreground sm:px-5">{money(row.principal)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums text-cyan-600 dark:text-cyan-300 sm:px-5">{money(row.interest)}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums text-foreground sm:px-5">{money(row.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!!rows.length && rows[rows.length-1]!.outstanding > 0 && <p className="text-sm text-destructive">{c("The stated payment does not clear the principal within the remaining term. Estimated balance after the last row:", "ဖြည့်ထားသော ပေးငွေဖြင့် ကျန်သက်တမ်းအတွင်း အရင်းမကျေပါ။ နောက်ဆုံးအတန်းအပြီး ခန့်မှန်းကျန်အရင်း:")} {money(rows[rows.length-1]!.outstanding)} {c("MMK","ကျပ်")}</p>}
      </>
    </div>
  </details>;
}
