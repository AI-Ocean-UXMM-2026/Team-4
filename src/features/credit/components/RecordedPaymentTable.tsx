import { useTranslation } from "@/lib/i18n";
import { recordedSchedule, type RecordedBalance } from "../recordedSchedule";

export function RecordedPaymentTable({balance}: {balance: RecordedBalance}) {
  const {language} = useTranslation();
  const c = (en:string,my:string) => language === "my" ? my : en;
  const rows = recordedSchedule(balance);
  const money = (n:number) => n.toLocaleString("en-US", {maximumFractionDigits:2});
  const date = (d:string) => `${d.slice(5,7)}/${d.slice(8,10)}/${d.slice(0,4)}`;
  return <details className="border-t pt-4">
    <summary className="bf-button inline-flex cursor-pointer list-none [&::-webkit-details-marker]:hidden">{c("View remaining payment table", "ကျန်အရစ်ကျဇယား ကြည့်ရန်")}</summary>
    <div className="mt-4 space-y-3">
      {rows ? <>
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
      </> : <p className="text-sm text-muted-foreground">{c("An estimate requires monthly reducing-balance terms without a final lump sum. Flat-rate, interest-only and other arrangements require the lender’s repayment schedule.", "ခန့်မှန်းဇယားအတွက် နောက်ဆုံးတစ်လုံးတည်းပေးငွေ မရှိသော လစဉ်လက်ကျန်လျော့အတိုး စည်းကမ်းချက်များ လိုပါသည်။ အတိုးပုံသေ၊ အတိုးသာဆပ်ခြင်းနှင့် အခြားအစီအစဉ်များအတွက် ချေးငွေပေးသူ၏ဇယား လိုပါသည်။")}</p>}
    </div>
  </details>;
}
