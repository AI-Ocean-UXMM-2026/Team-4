import { useTranslation } from "@/lib/i18n";
import { useState } from "react";
import type { ImportResult, SyncStatus as Status } from "@/lib/contracts";
import { usePlatform } from "@/app/providers";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  RotateCcw,
} from "lucide-react";

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
              <td className="p-2">{t(issue.reason)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SyncStatus({ status }: { status: Status }) {
  const { t } = useTranslation();
  const { business, imported } = usePlatform();
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const successfulImports = status.imports.filter(
    (b) => b.status === "success" || b.status === "up_to_date",
  );
  const failedImports = status.imports.filter((b) => b.status === "failed");

  const handleActivate = async (batchId: string, filename?: string | null) => {
    setActivatingId(batchId);
    try {
      await api(
        `/api/v1/data/activate-history?business_id=${encodeURIComponent(business.id)}&batch_id=${encodeURIComponent(batchId)}`,
        { method: "POST" },
      );
      if (filename) {
        try {
          localStorage.setItem(`bizflow-last-workbook:${business.id}`, filename);
        } catch {
          /* ignore storage error */
        }
      }
      await imported();
      toast.success(
        t("Active workbook switched successfully. All feature reports updated."),
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("Failed to activate past workbook"),
      );
    } finally {
      setActivatingId(null);
    }
  };

  const handleDownload = async (batchId: string, filename?: string | null) => {
    setDownloadingId(batchId);
    try {
      const blob = await api<Blob>(
        `/api/v1/data/history/${encodeURIComponent(batchId)}/download?business_id=${encodeURIComponent(business.id)}`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `workbook-${batchId.slice(0, 8)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Download failed"));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section className="bf-card space-y-6">
      {/* Header with Source & Version */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <h2 className="text-xl font-bold">{t("Past uploaded workbooks")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Switch to any past file to view its data across all reports")}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          {t("Data version")} {status.source_version}
        </span>
      </div>

      {/* Source Meta summary */}
      <dl className="grid gap-4 rounded-xl bg-muted/30 p-4 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">{t("Source")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {status.linked ? t("OneDrive workbook") : t("Manual Excel upload")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("Last successful import")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {status.last_import_at
              ? new Date(status.last_import_at).toLocaleString()
              : t("No imports yet")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("Cloud last checked")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {status.last_checked_at && status.linked
              ? new Date(status.last_checked_at).toLocaleString()
              : t("Not checked")}
          </dd>
        </div>
      </dl>

      {/* Clean List of Successful Snapshots */}
      {!successfulImports.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("No successful workbook imports yet.")}
        </p>
      ) : (
        <div className="space-y-3">
          {successfulImports.map((batch, index) => {
            const isCurrentlyActive =
              batch.source_version === status.source_version || index === 0;
            const isActivating = activatingId === batch.import_batch_id;
            const isDownloading = downloadingId === batch.import_batch_id;
            const displayName =
              batch.filename ||
              `${t("Workbook import")} (v${batch.source_version})`;

            return (
              <div
                key={batch.import_batch_id || index}
                className={`flex flex-col gap-3 rounded-2xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${
                  isCurrentlyActive
                    ? "border-primary/50 bg-primary/5 shadow-sm"
                    : "border-border/60 bg-card hover:border-border hover:shadow-sm"
                }`}
              >
                {/* File info */}
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      isCurrentlyActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {displayName}
                      </span>
                      {isCurrentlyActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 size={12} />
                          {t("Active snapshot")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          v{batch.source_version}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {batch.created_at
                          ? new Date(batch.created_at).toLocaleString()
                          : t("Previous import")}
                      </span>
                      <span>·</span>
                      <span>
                        {batch.row_counts.inserted || 0} {t("added ·")}{" "}
                        {batch.row_counts.updated || 0} {t("updated")}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {batch.import_batch_id && (
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={() =>
                        void handleDownload(
                          batch.import_batch_id!,
                          batch.filename,
                        )
                      }
                      title={t("Download")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Download size={14} />
                      <span className="hidden sm:inline">{t("Download")}</span>
                    </button>
                  )}

                  {!isCurrentlyActive && batch.import_batch_id && (
                    <button
                      type="button"
                      disabled={isActivating}
                      onClick={() =>
                        void handleActivate(
                          batch.import_batch_id!,
                          batch.filename,
                        )
                      }
                      className="bf-button inline-flex items-center gap-1.5 text-xs py-1.5 px-3.5 shadow-sm"
                    >
                      <RotateCcw
                        size={13}
                        className={isActivating ? "animate-spin" : ""}
                      />
                      <span>
                        {isActivating ? t("Activating…") : t("Load this file")}
                      </span>
                    </button>
                  )}

                  {isCurrentlyActive && (
                    <span className="text-xs font-semibold text-primary">
                      {t("Currently active across all features")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Discarded / Failed Attempts Drawer (Kept completely separate and clean) */}
      {failedImports.length > 0 && (
        <details className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-xs">
          <summary className="cursor-pointer font-semibold text-destructive flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <AlertTriangle size={15} />
              {t("Failed upload attempts ({0})", {
                "0": failedImports.length,
              })}
            </span>
            <span className="text-muted-foreground">
              {t("Click to view details")}
            </span>
          </summary>
          <div className="mt-3 space-y-3 pt-2">
            {failedImports.map((batch, idx) => (
              <div
                key={batch.import_batch_id || idx}
                className="rounded-xl border border-destructive/20 bg-background/80 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                  <span className="font-semibold text-destructive">
                    {batch.filename || t("Rejected file")}
                  </span>
                  <span>
                    {batch.created_at &&
                      new Date(batch.created_at).toLocaleString()}
                  </span>
                </div>
                <Issues result={batch} />
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
