import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Loan } from "../types";

const mmk = (amount: string | null) =>
  amount === null ? "Not available" : `${Number(amount).toLocaleString("en-US")} MMK`;
const day = (value: string | null) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "Not scheduled");

export function LoanSummary({ loan }: { loan: Loan }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{loan.lender || "Loan"}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Loan ID: {loan.loan_id}</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{loan.repayment_model.replaceAll("_", " ")}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Original principal" value={mmk(loan.principal_mmk)} />
          <Metric label="Outstanding principal" value={mmk(loan.outstanding_principal_mmk)} />
          <Metric label="Actual principal repaid" value={mmk(loan.actual_principal_paid_mmk)} />
          <Metric label="Actual interest paid" value={mmk(loan.actual_interest_paid_mmk)} />
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-t pt-4 text-sm">
          <p>Next scheduled payment: <strong>{mmk(loan.next_payment_due_mmk)}</strong></p>
          <p>Due: <strong>{day(loan.next_due_date)}</strong></p>
          <p>Status: <strong>{loan.next_payment_status === "unknown" ? "Payment status not linked to schedule" : loan.next_payment_status.replaceAll("_", " ")}</strong></p>
        </div>
        {loan.schedule_explanation && <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{loan.schedule_explanation}</p>}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}
