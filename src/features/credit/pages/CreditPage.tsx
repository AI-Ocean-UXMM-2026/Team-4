import { useTranslation } from "@/lib/i18n";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { CreditPrintReport } from "../components/CreditPrintReport";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditPreparationReport } from "../components/CreditPreparationReport";
import { LoanSummary } from "../components/LoanSummary";

import { RepaymentCapacity } from "../components/RepaymentCapacity";
import { RepaymentSchedule } from "../components/RepaymentSchedule";
import { useCredit } from "../hooks/useCredit";
import { BankLoanGuide } from "../components/BankLoanGuide";
import { importedApplication } from "../importedApplication";

export function CreditPage() {
  const { t } = useTranslation();

  const query = useCredit();
  const [loanId, setLoanId] = useState<string | null>(null);
  const [tab, setTab] = useState("loans");
  if (query.isPending) return <LoadingAnimation label="Loading credit information…" />;
  if (query.isError)
    return (
      <p role="alert" className="p-6 text-destructive">
        {t(query.error.message)}
      </p>
    );
  const data = query.data;
  const selected = data.loans.find((loan) => loan.loan_id === loanId) || data.loans[0];
  const selection = importedApplication(selected);
  return (
    <div className="credit-page space-y-5">
      <CreditPrintReport data={data} loan={selected} />
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          {t("Credit Hub")}
        </p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">
          {t("Manage credit and prepare records")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {t(
            "Track actual repayments separately from estimated obligations, and organize records for a financing discussion.",
          )}
        </p>
      </header>
      {data.data_quality.status !== "complete" && (
        <section
          className="bf-card border-warning/50 bg-warning/10"
          aria-label={t("Data limitations")}
        >
          <h2 className="text-sm font-semibold">{t("Information still needed")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {data.data_quality.limitations.map((item) => (
              <li key={item}>{t(item)}</li>
            ))}
          </ul>
        </section>
      )}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="h-auto max-w-full flex-wrap">
          <TabsTrigger value="loans">{t("Existing loans")}</TabsTrigger>
          <TabsTrigger value="readiness">{t("Prepare for credit")}</TabsTrigger>
          <TabsTrigger value="guide">{t("Bank loan guide")}</TabsTrigger>
        </TabsList>
        {data.loans.length > 1 && (
          <label className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">{t("Select loan")}</span>
            <select
              value={selected?.loan_id}
              onChange={(event) => setLoanId(event.target.value)}
              className="min-h-11 max-w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {data.loans.map((loan) => (
                <option key={loan.loan_id} value={loan.loan_id}>
                  {loan.lender} · {loan.loan_id}
                </option>
              ))}
            </select>
          </label>
        )}
        <TabsContent value="loans" className="space-y-4">
          {!data.loans.length ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("No loans recorded")}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {t(
                  "No imported loan rows were found. You can still use Prepare for Credit to organize business records.",
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {selected && (
                <>
                  <LoanSummary loan={selected} asOf={data.as_of} />
                  <RepaymentCapacity data={data.repayment_capacity} />
                  <RepaymentSchedule loan={selected} />
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("Actual payment log")}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {t(
                          "Imported payments only. Scheduled instalments are never marked paid automatically.",
                        )}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {selected.actual_payments.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[520px] text-left text-sm">
                            <thead>
                              <tr className="border-b text-muted-foreground">
                                <th className="p-2">{t("Date")}</th>
                                <th className="p-2">{t("Principal paid")}</th>
                                <th className="p-2">{t("Interest paid · expense")}</th>
                                <th className="p-2">{t("Payment ID")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selected.actual_payments.map((payment) => (
                                <tr className="border-b last:border-0" key={payment.payment_id}>
                                  <td className="p-2">{payment.date}</td>
                                  <td className="p-2">
                                    {Number(payment.principal_mmk).toLocaleString("en-US")}{" "}
                                    {t("MMK")}
                                  </td>
                                  <td className="p-2">
                                    {Number(payment.interest_mmk).toLocaleString("en-US")}{" "}
                                    {t("MMK")}
                                  </td>
                                  <td className="p-2">{payment.payment_id}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t("No actual payment rows have been imported.")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </TabsContent>
        <TabsContent value="readiness" className="space-y-4">
          {selection ? (
            <BankLoanGuide
              businessId={data.business_id}
              selection={selection}
              records={data.readiness}
              preparationOnly
              onViewRecords={() => setTab("readiness")}
            />
          ) : (
            <p className="bf-card text-sm text-muted-foreground">
              {t(
                "Import a supported bank and loan product in the Loans sheet to see the matching application requirements.",
              )}
            </p>
          )}
          <CreditPreparationReport report={data.preparation_report} loan={selected} />
        </TabsContent>
        <TabsContent value="guide">
          <BankLoanGuide businessId={data.business_id} onViewRecords={() => setTab("readiness")} />
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        {t(
          "Schedules are model estimates and may differ from lender statements because of fees, grace periods, day-count rules or variable rates.",
        )}
      </p>
    </div>
  );
}
