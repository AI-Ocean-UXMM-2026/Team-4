import { useTranslation } from "@/lib/i18n";
import type { CreditSummary, Loan } from "../types";
import { importedApplication } from "../importedApplication";
import { applicationProductName, applicationRequirements } from "./BankLoanGuide";

export function CreditPrintReport({ data, loan }: { data: CreditSummary; loan?: Loan | undefined }) {
  const { t, language } = useTranslation();
  const report = data.preparation_report;
  const application = importedApplication(loan);
  const requirements = application ? applicationRequirements(application) : [];
  return (
    <article className="credit-print-report">
      <header>
        <p className="report-brand">ရှေ့ဆက် — Shay Sett</p>
        <h1>{t("Borrower preparation summary")}</h1>
        <p>
          {application
            ? `${loan?.lender} · ${applicationProductName(application)}`
            : t("Imported business records")}
        </p>
      </header>
      <dl className="report-details">
        <div>
          <dt>{t("Business:")}</dt>
          <dd>{report.business_profile?.name || t("Not recorded")}</dd>
        </div>
        {report.business_profile?.industry && (
          <div>
            <dt>{t("Industry")}</dt>
            <dd>{report.business_profile.industry}</dd>
          </div>
        )}
        {report.business_profile?.city && (
          <div>
            <dt>{t("City")}</dt>
            <dd>{report.business_profile.city}</dd>
          </div>
        )}
        <div>
          <dt>{t("Records covered:")}</dt>
          <dd>
            {report.period_covered.start || "—"} – {report.period_covered.end || "—"}
          </dd>
        </div>
        <div>
          <dt>{t("Report date")}</dt>
          <dd>{data.as_of}</dd>
        </div>
      </dl>
      <section>
        <h2>{t("Application requirements")}</h2>
        {application ? (
          <>
            <p>
              {t("Loan ID:")} {loan?.loan_id} · {applicationProductName(application)}
            </p>
            <ul>
              {requirements.map((item) => (
                <li key={item[0]}>{item[language === "my" ? 1 : 0]}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>
            {t(
              "Import a supported bank and loan product in the Loans sheet to see the matching application requirements.",
            )}
          </p>
        )}
      </section>
      <section>
        <h2>1. {t("Record preparation progress")}</h2>
        <p>
          {t("{0} of {1} record categories already added", {
            "0": data.readiness_progress.prepared_categories,
            "1": data.readiness_progress.total_categories,
          })}
        </p>
        <table>
          <thead>
            <tr>
              <th>{t("Record category")}</th>
              <th>{t("Status:")}</th>
              <th>{t("Records")}</th>
              <th>{t("Period covered:")}</th>
            </tr>
          </thead>
          <tbody>
            {data.readiness.map((item) => (
              <tr key={item.category}>
                <td>{t(item.title)}</td>
                <td>
                  {t(
                    item.status === "uploaded_unverified"
                      ? "uploaded"
                      : item.status.replaceAll("_", " "),
                  )}
                </td>
                <td>{item.record_count}</td>
                <td>
                  {item.period_start || "—"}
                  <br />
                  {item.period_end || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="report-note">
          {t("Imported record presence does not verify a lender document.")}
        </p>
      </section>
      <section>
        <h2>2. {t("Outstanding loans:")}</h2>
        {data.loans.length ? (
          <table>
            <thead>
              <tr>
                <th>{t("Lender")}</th>
                <th>{t("Loan ID:")}</th>
                <th className="report-money">{t("Original principal")}</th>
                <th className="report-money">{t("Outstanding principal")}</th>
              </tr>
            </thead>
            <tbody>
              {data.loans.map((loan) => (
                <tr key={loan.loan_id}>
                  <td>{loan.lender || t("Not recorded")}</td>
                  <td>{loan.loan_id}</td>
                  <td className="report-money">
                    {Number(loan.principal_mmk).toLocaleString("en-US")} MMK
                  </td>
                  <td className="report-money">
                    {Number(loan.outstanding_principal_mmk).toLocaleString("en-US")} MMK
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>{t("No loans recorded")}</p>
        )}
      </section>
      <section>
        <h2>3. {t("Missing preparation items:")}</h2>
        {data.readiness.some((item) => item.status === "missing") ? (
          <ul>
            {data.readiness
              .filter((item) => item.status === "missing")
              .map((item) => (
                <li key={item.category}>
                  {t(item.title)}
                  {item.note ? ` — ${t(item.note)}` : ""}
                </li>
              ))}
          </ul>
        ) : (
          <p>{t("No missing categories identified from available records")}</p>
        )}
      </section>
      <section>
        <h2>4. {t("Information still needed")}</h2>
        <ul>
          {data.data_quality.limitations.map((note) => (
            <li key={note}>{t(note)}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>{t("Repayment planning")}</h2>
        <p>{t(data.repayment_capacity.explanation)}</p>
        {data.repayment_capacity.projected_cash_available_before_loan_mmk !== null && (
          <p>
            {t("Cash available")}:{" "}
            {Number(
              data.repayment_capacity.projected_cash_available_before_loan_mmk,
            ).toLocaleString("en-US")}{" "}
            MMK
          </p>
        )}
      </section>
      <p className="report-disclaimer">
        {t("Record presence only. Preparation progress is not a credit score or loan approval.")}
      </p>
    </article>
  );
}
