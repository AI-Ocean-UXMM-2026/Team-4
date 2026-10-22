import { BellRing, CalendarClock } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { recordedSchedule } from "../recordedSchedule";
import type { CreditSummary } from "../types";

type WindowDays = 7 | 30 | 90;
type Payment = { id: string; lender: string; dueDate: string; amount: string | number; estimated: boolean };

const dayNumber = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

const displayDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
};

export function UpcomingPaymentTimeline({ data }: { data: CreditSummary }) {
  const { t } = useTranslation();
  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const payments = ([
    ...data.loans.flatMap((loan): Payment[] => {
      if (loan.schedule_status === "available") {
        return loan.schedule
          .filter((line) => !loan.next_due_date || dayNumber(line.due_date) >= dayNumber(loan.next_due_date))
          .map((line) => ({ id: `loan-${loan.loan_id}-${line.period}`, lender: loan.lender, dueDate: line.due_date, amount: line.scheduled_installment_mmk, estimated: true }));
      }
      return loan.next_due_date && loan.next_payment_due_mmk !== null
        ? [{ id: `loan-${loan.loan_id}`, lender: loan.lender, dueDate: loan.next_due_date, amount: loan.next_payment_due_mmk, estimated: true }]
        : [];
    }),
    ...(data.recorded_balances ?? []).flatMap((balance): Payment[] => {
      const schedule = recordedSchedule(balance);
      if (schedule) return schedule.map((line) => ({ id: `balance-${balance.id}-${line.period}`, lender: balance.lender_name, dueDate: line.date, amount: line.payment, estimated: true }));
      return balance.next_payment_date && balance.next_payment_mmk != null
        ? [{ id: `balance-${balance.id}`, lender: balance.lender_name, dueDate: balance.next_payment_date, amount: balance.next_payment_mmk, estimated: false }]
        : [];
    }),
  ] as Payment[])
    .map((item) => ({ ...item, daysUntilDue: Math.round((dayNumber(item.dueDate) - dayNumber(data.as_of)) / 86400000) }))
    .filter((item) => item.daysUntilDue <= windowDays)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const status = (days: number) => {
    if (days < 0) return { label: `${Math.abs(days)} ${t("days overdue")}`, tone: "bg-rose-100 text-rose-800" };
    if (days === 0) return { label: t("Due today"), tone: "bg-rose-100 text-rose-800" };
    if (days <= 7) return { label: `${t("Due in")} ${days} ${t("days")}`, tone: "bg-amber-100 text-amber-800" };
    return { label: `${t("Due in")} ${days} ${t("days")}`, tone: "bg-secondary text-primary" };
  };

  return <Card aria-label={t("Upcoming payment timeline")} className="overflow-hidden">
    <CardHeader className="gap-3 border-b border-border/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BellRing size={19} aria-hidden="true" /></span>
        <div className="min-w-0">
          <CardTitle className="text-xl leading-snug sm:text-2xl">{t("Upcoming payment timeline")}</CardTitle>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{t("Loan payments due in the selected period, including overdue items")}</p>
        </div>
      </div>
      <div className="grid w-full shrink-0 grid-cols-3 rounded-xl bg-muted p-1 sm:w-auto" aria-label={t("Payment timeline period")}>
        {([7, 30, 90] as const).map((days) => <button key={days} type="button" aria-pressed={windowDays === days} onClick={() => setWindowDays(days)} className={`min-h-9 min-w-20 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${windowDays === days ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}>
          {t("Next")} {days} {t("days")}
        </button>)}
      </div>
    </CardHeader>
    <CardContent className="p-5 sm:p-6">
      {payments.length === 0
        ? <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-4 py-7 text-center">
            <CalendarClock size={22} className="text-muted-foreground/70" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">{t("No recorded loan payments are due in this period.")}</p>
          </div>
        : <ul className="divide-y divide-border rounded-xl border border-border">{payments.map((payment) => {
          const paymentStatus = status(payment.daysUntilDue);
          return <li key={payment.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3"><CalendarClock size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0">
              <p className="truncate font-medium text-foreground">{payment.lender}</p>
              <p className="mt-1 text-sm text-muted-foreground"><time dateTime={payment.dueDate}>{displayDate(payment.dueDate)}</time>{" · "}{Number(payment.amount).toLocaleString("en-US")} {t("MMK")}{payment.estimated && <> {" · "}{t("Estimated")}</>}</p>
            </div></div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${paymentStatus.tone}`}>{paymentStatus.label}</span>
          </li>;
        })}</ul>}
    </CardContent>
  </Card>;
}
