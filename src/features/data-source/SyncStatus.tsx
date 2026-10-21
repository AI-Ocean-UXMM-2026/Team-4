import { useTranslation } from "@/lib/i18n";
import type { ImportResult, SyncStatus as Status } from "@/lib/contracts";
export function Issues({ result }: { result: ImportResult }) {
  const { t } = useTranslation();

  const issues = [...result.errors, ...result.warnings];
  if (!issues.length) return null;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2">{t("Sheet")}</th>
            <th className="p-2">{t("Excel row")}</th>
            <th className="p-2">{t("Field")}</th>
            <th className="p-2">{t("Action needed")}</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, index) => (
            <tr key={index} className="border-b align-top">
              <td className="p-2">{issue.sheet}</td>
              <td className="p-2">{issue.row || t("Previous import")}</td>
              <td className="p-2">{issue.field}</td>
              <td className="p-2">{issue.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function SyncStatus({ status }: { status: Status }) {
  const { t } = useTranslation();

  return (
    <section className="bf-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("Import history")}</h2>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
          {t("Data version")} {status.source_version}
        </span>
      </div>
      <dl className="my-5 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">{t("Source")}</dt>
          <dd className="mt-1 font-semibold">
            {status.linked ? t("OneDrive workbook") : t("Manual Excel upload")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("Last successful import")}</dt>
          <dd className="mt-1 font-semibold">
            {status.last_import_at
              ? new Date(status.last_import_at).toLocaleString()
              : t("No imports yet")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("Cloud last checked")}</dt>
          <dd className="mt-1 font-semibold">
            {status.last_checked_at && status.linked
              ? new Date(status.last_checked_at).toLocaleString()
              : t("Not checked")}
          </dd>
        </div>
      </dl>
      {!status.imports.length ? (
        <p className="text-sm text-muted-foreground">{t("Your first upload will appear here.")}</p>
      ) : (
        <div className="space-y-3">
          {status.imports.map((batch, index) => (
            <details key={batch.import_batch_id || index} className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm">
                <span
                  className={
                    batch.status === "failed"
                      ? "font-semibold text-destructive"
                      : "font-semibold text-primary"
                  }
                >
                  {batch.status === "up_to_date"
                    ? t("Already up to date")
                    : batch.status === "failed"
                      ? t("Rejected — records preserved")
                      : t("Imported")}
                </span>
                <span className="ml-3 text-muted-foreground">
                  {batch.created_at && new Date(batch.created_at).toLocaleString()} ·{" "}
                  {batch.row_counts.inserted || 0} {t("added ·")} {batch.row_counts.updated || 0}{" "}
                  {t("updated")}
                  {batch.errors.length + batch.warnings.length > 0 &&
                    ` · ${batch.errors.length} errors, ${batch.warnings.length} warnings`}
                </span>
              </summary>
              <Issues result={batch} />
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
