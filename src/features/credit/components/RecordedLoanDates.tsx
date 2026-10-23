import { useTranslation } from "@/lib/i18n";
import { estimatedFinalPaymentDate, type RecordedBalance } from "../recordedSchedule";

export function RecordedLoanDates({balance}: {balance:RecordedBalance}) {
  const {language} = useTranslation();
  const c = (en:string,my:string) => language === "my" ? my : en;
  const format = (date:string) => `${date.slice(5,7)}/${date.slice(8,10)}/${date.slice(0,4)}`;
  const end = balance.loan_end_date || estimatedFinalPaymentDate(balance);
  const dates = [
    {label:c("Loan start date","ချေးငွေစယူသည့်ရက်"),date:balance.loan_start_date},
    {label:c("Loan end date","ချေးငွေပြီးဆုံးမည့်ရက်"),date:end},
  ];
  return <div className="border-t border-border bg-muted/35 px-5 py-4 sm:px-6">
    <div className="grid gap-4 sm:grid-cols-2">
      {dates.map(({label,date}, index) => <div key={label} className={`min-w-0 ${index ? "border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0" : ""}`}>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate font-semibold tabular-nums text-foreground">{date ? format(date) : c("Not recorded","မဖြည့်ထားပါ")}</p>
        </div>
      </div>)}
    </div>
    <p className="mt-3 text-right text-[10px] uppercase tracking-wider text-muted-foreground">{c("Date format: MM/DD/YYYY", "ရက်စွဲပုံစံ: MM/DD/YYYY")}</p>
  </div>;
}
