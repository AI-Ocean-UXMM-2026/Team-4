import { useTranslation } from "@/lib/i18n";
import type { CreditSummary } from "../types";

export function CreditPrintReport({ data }: { data: CreditSummary }) {
  const { t } = useTranslation();
  const report = data.preparation_report;
  return (
    <article className="credit-print-report">
      <header>
        <p className="report-brand">ရှေ့ဆက် — Shay Sett</p>
        <h1>{t("Borrower preparation summary")}</h1>
        <p>{t("Generic preparation checklist · not lender-specific")}</p>
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
                <td>{t(item.status.replaceAll("_", " "))}</td>
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
      <p className="report-disclaimer">
        {t("Record presence only. Preparation progress is not a credit score or loan approval.")}
      </p>
    </article>
  );
}
