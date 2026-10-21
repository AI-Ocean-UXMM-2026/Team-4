import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Loan } from "../types";

const money = (value: string) => `${Number(value).toLocaleString("en-US")} MMK`;
const date = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString();

export function RepaymentSchedule({ loan }: { loan: Loan }) {
  if (loan.schedule_status !== "available") {
    return <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{loan.schedule_explanation}</p>;
  }
  return (
    <Card>
      <CardHeader><CardTitle>Modelled schedule · {loan.loan_id}</CardTitle><p className="text-sm text-muted-foreground">Scheduled obligations are estimates. They are kept separate from actual imported payments.</p></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead><tr className="border-b text-muted-foreground"><th className="p-2">Due</th><th className="p-2">Instalment · scheduled</th><th className="p-2">Principal</th><th className="p-2">Interest</th><th className="p-2">Projected balance</th></tr></thead>
          <tbody>{loan.schedule.map((line) => <tr className="border-b last:border-0" key={line.period}><td className="p-2">{date(line.due_date)}</td><td className="p-2">{money(line.scheduled_installment_mmk)}</td><td className="p-2">{money(line.principal_due_mmk)}</td><td className="p-2">{money(line.interest_due_mmk)}</td><td className="p-2">{money(line.projected_principal_mmk)}</td></tr>)}</tbody>
        </table>
      </CardContent>
    </Card>
  );
}
