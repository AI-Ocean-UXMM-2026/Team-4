import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreditSummary } from "../types";

export function RepaymentCapacity({ data }: { data: CreditSummary["repayment_capacity"] }) {
  const { t } = useTranslation();
  const [showBreakdown, setShowBreakdown] = useState(false);

  const title =
    data.status === "potential_shortfall"
      ? "Potential cash shortfall"
      : "Appears covered from recorded cash";
  const formatMmk = (value: string | null) =>
    value === null ? t("Unavailable") : `${Number(value).toLocaleString("en-US")} ${t("MMK")}`;
  const breakdown = [
    { label: "Recorded cash", value: data.recorded_cash_mmk, operator: "" },
    { label: "Outstanding supplier balances", value: data.outstanding_supplier_balances_mmk, operator: "−" },
    { label: "Unpaid expenses", value: data.unpaid_expenses_mmk, operator: "−" },
    { label: "Next loan payment", value: data.next_loan_payment_mmk, operator: "−" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("Cash after next payment")}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.status === "insufficient_data" ? (
          <p className="text-sm text-muted-foreground">{t(data.explanation)}</p>
        ) : (
          <>
        <p className="font-semibold">{t(title)}</p>
        <p className="text-sm text-muted-foreground">{t(data.explanation)}</p>
        {data.repayment_gap_mmk !== null && (
          <p className="mt-4 border-t border-border pt-4 font-semibold">
            {t(Number(data.repayment_gap_mmk) >= 0 ? "Estimated cash remaining after repayment:" : "Estimated repayment shortfall:")}{" "}
            {Math.abs(Number(data.repayment_gap_mmk)).toLocaleString("en-US")} {t("MMK")}
          </p>
        )}
        <button
          type="button"
          aria-expanded={showBreakdown}
          aria-controls="repayment-calculation-breakdown"
          onClick={() => setShowBreakdown((visible) => !visible)}
          className="mt-4 flex w-full items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
        >
          {t(showBreakdown ? "Hide calculation" : "Show calculation")}
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={`transition-transform ${showBreakdown ? "rotate-180" : ""}`}
          />
        </button>
        {showBreakdown && (
          <dl
            id="repayment-calculation-breakdown"
            className="mt-3 divide-y divide-border rounded-xl border border-border bg-muted/30 px-4"
          >
            {breakdown.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 py-3 text-sm">
                <dt className="text-muted-foreground">
                  {item.operator && <span className="mr-2 font-semibold text-foreground">{item.operator}</span>}
                  {t(item.label)}
                </dt>
                <dd className="text-right font-medium tabular-nums">{formatMmk(item.value)}</dd>
              </div>
            ))}
          </dl>
        )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
