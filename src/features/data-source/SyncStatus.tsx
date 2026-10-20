import type { ImportResult, SyncStatus as Status } from "@/lib/contracts";
export function Issues({ result }: { result: ImportResult }) {
  const issues = [...result.errors, ...result.warnings];
  if (!issues.length) return null;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2">Sheet</th>
            <th className="p-2">Excel row</th>
            <th className="p-2">Field</th>
            <th className="p-2">Action needed</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, index) => (
            <tr key={index} className="border-b align-top">
              <td className="p-2">{issue.sheet}</td>
              <td className="p-2">{issue.row || "Previous import"}</td>
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
  return (
    <section className="bf-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Import history</h2>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
          Data version {status.source_version}
        </span>
      </div>
      <dl className="my-5 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Source</dt>
          <dd className="mt-1 font-semibold">
            {status.linked ? "OneDrive workbook" : "Manual Excel upload"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last successful import</dt>
          <dd className="mt-1 font-semibold">
            {status.last_import_at
              ? new Date(status.last_import_at).toLocaleString()
              : "No imports yet"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cloud last checked</dt>
          <dd className="mt-1 font-semibold">
            {status.last_checked_at && status.linked
              ? new Date(status.last_checked_at).toLocaleString()
              : "Not checked"}
          </dd>
        </div>
      </dl>
      {!status.imports.length ? (
        <p className="text-sm text-muted-foreground">Your first upload will appear here.</p>
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
                    ? "Already up to date"
                    : batch.status === "failed"
                      ? "Rejected — records preserved"
                      : "Imported"}
                </span>
                <span className="ml-3 text-muted-foreground">
                  {batch.created_at && new Date(batch.created_at).toLocaleString()} ·{" "}
                  {batch.row_counts.inserted || 0} added · {batch.row_counts.updated || 0} updated
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
