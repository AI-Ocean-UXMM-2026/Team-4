import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { useCredit } from "../hooks/useCredit";
import type { CreditSummary } from "../types";

export type PaymentReminder = {
  id: string;
  lender: string;
  dueDate: string;
  amount: string;
  daysUntilDue: number;
};

const dayNumber = (value: string) => {
  const [year = 0, month = 1, day = 1] = value.slice(0, 10).split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
};

export function paymentReminders(data: CreditSummary, today: string): PaymentReminder[] {
  return [
    ...data.loans.flatMap((loan) =>
      loan.next_due_date && loan.next_payment_due_mmk !== null
        ? [{ id: `loan-${loan.loan_id}`, lender: loan.lender, dueDate: loan.next_due_date, amount: loan.next_payment_due_mmk }]
        : [],
    ),
    ...(data.recorded_balances ?? []).flatMap((balance) =>
      balance.next_payment_date && balance.next_payment_mmk != null
        ? [{ id: `balance-${balance.id}`, lender: balance.lender_name, dueDate: balance.next_payment_date, amount: balance.next_payment_mmk }]
        : [],
    ),
  ]
    .map((item) => ({
      ...item,
      daysUntilDue: Math.round((dayNumber(item.dueDate) - dayNumber(today)) / 86400000),
    }))
    .filter((item) => item.daysUntilDue >= 0 && item.daysUntilDue <= 7)
    .sort((left, right) => left.daysUntilDue - right.daysUntilDue);
}

const localDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function PaymentReminderNotifier() {
  const { t } = useTranslation();
  const query = useCredit();

  useEffect(() => {
    if (!query.data) return;
    for (const reminder of paymentReminders(query.data, localDate())) {
      const storageKey = `shay-sett-payment-reminder:${query.data.business_id}:${reminder.id}:${reminder.dueDate}`;
      try {
        if (sessionStorage.getItem(storageKey)) continue;
        sessionStorage.setItem(storageKey, "shown");
      } catch {
        // Still notify when browser storage is unavailable.
      }
      const timing = reminder.daysUntilDue === 0
        ? t("Due today")
        : `${t("Due in")} ${reminder.daysUntilDue} ${t("days")}`;
      toast.warning(`${t("Loan payment reminder")} · ${timing}`, {
        description: `${reminder.lender} · ${Number(reminder.amount).toLocaleString("en-US")} ${t("MMK")}`,
        duration: 8000,
      });
    }
  }, [query.data, t]);

  return null;
}
