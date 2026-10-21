import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditPreparationReport } from "../components/CreditPreparationReport";
import { LoanSummary } from "../components/LoanSummary";
import { ReadinessChecklist } from "../components/ReadinessChecklist";
import { RepaymentCapacity } from "../components/RepaymentCapacity";
import { RepaymentSchedule } from "../components/RepaymentSchedule";
import { useCredit } from "../hooks/useCredit";

export function CreditPage() {
  const query = useCredit();
  const [loanId, setLoanId] = useState<string | null>(null);
  if (query.isPending) return <p role="status" className="p-6 text-muted-foreground">Loading credit information…</p>;
  if (query.isError) return <p role="alert" className="p-6 text-destructive">{query.error.message}</p>;
  const data = query.data;
  const selected = data.loans.find((loan) => loan.loan_id === loanId) || data.loans[0];
  return (
    <div className="space-y-5">
      <header><p className="text-sm font-medium text-primary">Credit Hub</p><h1 className="mt-1 text-3xl font-bold">Manage credit and prepare records</h1><p className="mt-2 text-muted-foreground">Track actual repayments separately from estimated obligations, and organize records for a financing discussion.</p></header>
      {data.data_quality.status !== "complete" && <Card><CardHeader className="pb-2"><CardTitle className="text-base">Some credit information is not available yet</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground"><ul className="list-disc space-y-1 pl-5">{data.data_quality.limitations.map((item) => <li key={item}>{item}</li>)}</ul></CardContent></Card>}
      <Tabs defaultValue="loans" className="space-y-4">
        <TabsList><TabsTrigger value="loans">Existing loans</TabsTrigger><TabsTrigger value="readiness">Prepare for credit</TabsTrigger></TabsList>
        <TabsContent value="loans" className="space-y-4">
          {!data.loans.length ? <Card><CardHeader><CardTitle>No loans recorded</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">No imported loan rows were found. You can still use Prepare for Credit to organize business records.</CardContent></Card> : <>
            {data.loans.length > 1 && <label className="flex items-center gap-2 text-sm">Select loan<select className="rounded-md border bg-background px-3 py-2" value={selected?.loan_id} onChange={(event) => setLoanId(event.target.value)}>{data.loans.map((loan) => <option key={loan.loan_id} value={loan.loan_id}>{loan.lender} · {loan.loan_id}</option>)}</select></label>}
            {selected && <><LoanSummary loan={selected} /><RepaymentCapacity data={data.repayment_capacity} /><RepaymentSchedule loan={selected} />
              <Card><CardHeader><CardTitle>Actual payment log</CardTitle><p className="text-sm text-muted-foreground">Imported payments only. Scheduled instalments are never marked paid automatically.</p></CardHeader><CardContent>{selected.actual_payments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2">Date</th><th className="p-2">Principal paid</th><th className="p-2">Interest paid · expense</th><th className="p-2">Payment ID</th></tr></thead><tbody>{selected.actual_payments.map((payment) => <tr className="border-b last:border-0" key={payment.payment_id}><td className="p-2">{payment.date}</td><td className="p-2">{Number(payment.principal_mmk).toLocaleString("en-US")} MMK</td><td className="p-2">{Number(payment.interest_mmk).toLocaleString("en-US")} MMK</td><td className="p-2">{payment.payment_id}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">No actual payment rows have been imported.</p>}</CardContent></Card>
            </>}
          </>}
        </TabsContent>
        <TabsContent value="readiness" className="space-y-4">
          <Card><CardHeader><CardTitle>{data.readiness_progress.label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data.readiness_progress.prepared_categories} / {data.readiness_progress.total_categories} categories</p><p className="mt-1 text-sm text-muted-foreground">Record presence only. Preparation progress is not a credit score or loan approval.</p></CardContent></Card>
          <ReadinessChecklist items={data.readiness} /><CreditPreparationReport report={data.preparation_report} />
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">Schedules are model estimates and may differ from lender statements because of fees, grace periods, day-count rules or variable rates.</p>
    </div>
  );
}
