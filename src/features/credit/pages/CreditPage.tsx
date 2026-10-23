import { useTranslation } from "@/lib/i18n";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { NextStepCard } from "@/components/NextStepCard";
import { CreditPrintReport } from "../components/CreditPrintReport";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditPreparationReport } from "../components/CreditPreparationReport";
import { LoanSummary } from "../components/LoanSummary";

import { RepaymentSchedule } from "../components/RepaymentSchedule";
import { UpcomingPaymentTimeline } from "../components/UpcomingPaymentTimeline";
import { useCredit } from "../hooks/useCredit";
import { ApplicationSelector, BankLoanGuide } from "../components/BankLoanGuide";
import type { GuideSelection } from "../components/BankLoanGuide";
import { importedApplication } from "../importedApplication";
import { LoanRecording } from "../components/RecordLoanForm";
import { RecordedLoanDates } from "../components/RecordedLoanDates";
import { NextPaymentForm } from "../components/NextPaymentForm";
import { LoanBalanceActions } from "../components/LoanBalanceActions";
import loanCatalog from "../../../../shared/contracts/loan-products.json";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { ApplicationDocument } from "../types";
import { Banknote, BookOpen, CalendarDays, FileText } from "lucide-react";

export function CreditPage() {
  const { t } = useTranslation();

  const query = useCredit();
  const [preparationSelection, setPreparationSelection] = useState<GuideSelection | null>(null);
  const [loanId, setLoanId] = useState<string | null>(null);
  const [mode, setMode] = useState("loans");
  const [preparationTab, setPreparationTab] = useState("readiness");
  const currentLoan = query.data?.loans.find(loan => loan.loan_id === loanId) || query.data?.loans[0];
  const recordedApplication = query.data?.recorded_balances?.map(balance => importedApplication({
    bank_id: balance.bank_id ?? null, loan_product_id: balance.loan_product_id ?? null,
    lender: balance.lender_name, loan_product: null,
  })).find(Boolean) || null;
  const currentApplication = preparationSelection || importedApplication(currentLoan) || recordedApplication;
  const savedApplications = useQuery({
    queryKey: ["saved-applications", query.data?.business_id],
    enabled: !!query.data?.business_id,
    queryFn: () => api<{applications: {bank_id: string; product_id: string; filenames: string[]; updated_at: string}[]}>(`/api/v1/credit/saved-applications?business_id=${encodeURIComponent(query.data!.business_id)}`),
  });
  const files = useQuery({
    queryKey: ["credit-documents", query.data?.business_id, currentApplication?.bank, currentApplication?.productId],
    enabled: !!currentApplication && !!query.data,
    queryFn: () => api<{documents: ApplicationDocument[]}>(`/api/v1/credit/documents?${new URLSearchParams({
      business_id: query.data!.business_id, bank_id: currentApplication!.bank,
      product_id: `${currentApplication!.bank}-${currentApplication!.productId}`,
    })}`),
  });
  if (query.isPending) return <LoadingAnimation label="Loading credit information…" />;
  if (query.isError)
    return (
      <p role="alert" className="p-6 text-destructive">
        {t(query.error.message)}
      </p>
    );
  const data = query.data;
  const selected = data.loans.find((loan) => loan.loan_id === loanId) || data.loans[0];
  const selection = preparationSelection || importedApplication(selected) || recordedApplication;
  const savedSelections = (savedApplications.data?.applications || []).flatMap(item => {
    const bank = loanCatalog.banks.find(bank => bank.id === item.bank_id);
    const product = bank?.products.find(product => product.id === item.product_id);
    return bank && product ? [{id: `${bank.id}:${product.id}`, label: `${bank.name} · ${product.name} · ${item.filenames.length} ${t("files")}`, selection: {bank: bank.id, productId: product.id.slice(bank.id.length + 1)}}] : [];
  });
  return (
    <div className="credit-page space-y-5">
      <CreditPrintReport data={data} loan={selected} files={files.data?.documents || []} filesStatus={files.isError ? "error" : files.isFetching ? "loading" : "ready"} />
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t("Credit Hub")}</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">
          {t("Manage credit and prepare records")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {t(
            "Track actual repayments separately from estimated obligations, and organize records for a financing discussion.",
          )}
        </p>
      </header>
      <Tabs value={mode} onValueChange={setMode} className="space-y-4">
        <section className="rounded-3xl border border-primary/30 bg-primary/5 p-5 sm:p-7" aria-label={t("Choose a credit option")}>
          <div>
            <h2 className="text-xl font-bold">{t("Choose what you want to do")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Manage a loan you already have or prepare your business for a new credit application.")}
            </p>
          </div>
          <TabsList className="mt-5 grid h-auto w-full grid-cols-1 items-stretch gap-3 bg-transparent p-0 sm:grid-cols-2">
            <TabsTrigger
              value="loans"
              className="min-h-28 w-full items-start justify-start whitespace-normal rounded-2xl border border-primary bg-primary p-5 text-left text-primary-foreground shadow-sm transition-colors hover:bg-[var(--primary-hover)] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
            >
              <span>
                <span className="block text-lg font-semibold">{t("Existing Loan")}</span>
                <span className="mt-2 block text-sm font-normal leading-relaxed">
                  {t("Record a loan or view and manage loans you already have.")}
                </span>
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="prepare"
              className="min-h-28 w-full items-start justify-start whitespace-normal rounded-2xl border border-primary bg-primary p-5 text-left text-primary-foreground shadow-sm transition-colors hover:bg-[var(--primary-hover)] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
            >
              <span>
                <span className="block text-lg font-semibold">{t("Prepare for New Credit")}</span>
                <span className="mt-2 block text-sm font-normal leading-relaxed">
                  {t("Compare loan options and prepare the records needed for a new application.")}
                </span>
              </span>
            </TabsTrigger>
          </TabsList>
        </section>
        <TabsContent value="loans" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{t("Manage existing loans")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("Record balances, upcoming payments and actual repayments for loans you already have.")}</p>
          </div>
          {!!(data.loans.length || data.recorded_balances?.length) && <UpcomingPaymentTimeline data={data} />}
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
          <LoanRecording key={data.business_id} businessId={data.business_id} hasLoans={!!(data.loans.length || data.recorded_balances?.length)} />
          {(data.recorded_balances || []).map(balance => <Card key={balance.id} className="overflow-hidden">
            <CardHeader className="min-h-44 border-b px-7 py-8 sm:px-9">
              <div className="w-full min-w-0 space-y-2">
                <CardTitle className="break-words text-2xl leading-snug sm:text-3xl">{balance.lender_name}</CardTitle>
                {balance.loan_product_id && <p className="break-words text-lg text-muted-foreground sm:text-xl">{loanCatalog.banks.flatMap(bank => bank.products).find(product => product.id === balance.loan_product_id)?.name || balance.loan_product_id}</p>}
              </div>
              <div className="w-full min-w-0">
                <LoanBalanceActions businessId={data.business_id} balance={balance} asOf={data.as_of}/>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-4 px-5 py-5 sm:px-6">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Banknote className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">{t("Outstanding principal")}</p>
                    <p className="mt-1 break-words text-3xl font-bold tracking-tight sm:text-4xl">
                      {Number(balance.outstanding_principal_mmk).toLocaleString("en-US")} <span className="text-sm font-semibold text-muted-foreground sm:text-base">{t("MMK")}</span>
                    </p>
                  </div>
                </div>
                <RecordedLoanDates balance={balance} />
              </div>
              <NextPaymentForm businessId={data.business_id} balance={balance} asOf={data.as_of} />
            </CardContent>
          </Card>)}
          {!data.loans.length && !data.recorded_balances?.length ? (
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
        <TabsContent value="prepare" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">{t("Prepare for a new loan")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("Compare suitable bank products and prepare the records needed for an application.")}</p>
          </div>
          <Tabs value={preparationTab} onValueChange={setPreparationTab} className="space-y-4">
            <TabsList className="grid h-auto w-full max-w-xl grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-2">
              <TabsTrigger
                value="readiness"
                className="min-h-14 justify-start gap-2.5 whitespace-normal rounded-xl border border-border bg-card px-4 py-2.5 text-left shadow-sm hover:border-primary/50 hover:bg-accent/40 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
              >
                <FileText className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{t("Application preparation")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="guide"
                className="min-h-14 justify-start gap-2.5 whitespace-normal rounded-xl border border-border bg-card px-4 py-2.5 text-left shadow-sm hover:border-primary/50 hover:bg-accent/40 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
              >
                <BookOpen className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{t("Bank loan guide")}</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="readiness" className="space-y-4">
              <ApplicationSelector
                selection={selection || {bank: "kbz", productId: "term"}}
                onSelectionChange={setPreparationSelection}
                savedSelections={savedSelections}
              />
              <BankLoanGuide
                businessId={data.business_id}
                {...(selection ? {selection} : {})}
                onSelectionChange={setPreparationSelection}
                savedSelections={savedSelections}
                records={data.readiness}
                preparationOnly
                showSelector={false}
                onViewRecords={() => setPreparationTab("readiness")}
              />
              <CreditPreparationReport report={data.preparation_report} loan={selected} />
            </TabsContent>
            <TabsContent value="guide">
              <BankLoanGuide businessId={data.business_id} onViewRecords={() => setPreparationTab("readiness")} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        {t(
          "Schedules are model estimates and may differ from lender statements because of fees, grace periods, day-count rules or variable rates.",
        )}
      </p>
      <NextStepCard
        heading="Get a clearer picture of your business"
        description="Review your financial records together and discover evidence-based recommendations."
        action="Open AI Analyzer"
        to="/ai"
      />
    </div>
  );
}
