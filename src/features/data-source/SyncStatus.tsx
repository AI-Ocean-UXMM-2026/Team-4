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
  const [expanded, setExpanded] = useState(false);
  const [showDetailedRows, setShowDetailedRows] = useState(false);

  const rawIssues = [...result.errors, ...result.warnings];
  if (!rawIssues.length) return null;

  // Separate ownership issues (business_id mismatch across rows/sheets)
  const ownershipIssues = rawIssues.filter(
    (i) => i.field === "business_id" && i.reason === "Row belongs to another business",
  );
  const otherIssues = rawIssues.filter(
    (i) => !(i.field === "business_id" && i.reason === "Row belongs to another business"),
  );

  // Group non-ownership issues by sheet + field + reason
  const otherGroupedMap = new Map<
    string,
    {
      sheet: string;
      field: string;
      reason: string;
      rows: number[];
    }
  >();

  for (const issue of otherIssues) {
    const key = `${issue.sheet}::${issue.field}::${issue.reason}`;
    const existing = otherGroupedMap.get(key);
    if (existing) {
      existing.rows.push(issue.row);
    } else {
      otherGroupedMap.set(key, {
        sheet: issue.sheet,
        field: issue.field,
        reason: issue.reason,
        rows: [issue.row],
      });
    }
  }

  type GroupedIssueItem = {
    key: string;
    sheet: string;
    rowDisplay: string;
    field: string;
    reason: string;
    count: number;
    isOwnership?: boolean;
  };

  const groupedIssues: GroupedIssueItem[] = [];

  // 1. Add non-ownership issues first so real validation errors aren't hidden
  for (const [key, group] of otherGroupedMap.entries()) {
    let rowDisplay = "";
    if (group.rows.length === 1) {
      rowDisplay = String(group.rows[0] ?? t("Previous import"));
    } else {
      rowDisplay = t("Row {0} (+{1} more)", {
        "0": group.rows[0] ?? 0,
        "1": group.rows.length - 1,
      });
    }
    groupedIssues.push({
      key,
      sheet: group.sheet,
      rowDisplay,
      field: group.field,
      reason: group.reason,
      count: group.rows.length,
    });
  }

  // 2. Add consolidated ownership issue if present
  if (ownershipIssues.length > 0) {
    if (ownershipIssues.length === 1) {
      const single = ownershipIssues[0]!;
      groupedIssues.push({
        key: "ownership-single",
        sheet: single.sheet,
        rowDisplay: String(single.row || t("Previous import")),
        field: single.field,
        reason: single.reason,
        count: 1,
        isOwnership: true,
      });
    } else {
      const uniqueSheets = Array.from(new Set(ownershipIssues.map((i) => i.sheet)));
      const firstSheet = uniqueSheets[0] ?? "";
      const sheetDisplay =
        uniqueSheets.length === 1
          ? firstSheet
          : `${firstSheet} (+${uniqueSheets.length - 1} ${t("other sheets")})`;

      groupedIssues.push({
        key: "ownership-consolidated",
        sheet: sheetDisplay,
        rowDisplay: t("Multiple rows ({0})", { "0": ownershipIssues.length }),
        field: "business_id",
        reason: "Row belongs to another business",
        count: ownershipIssues.length,
        isOwnership: true,
      });
    }
  }

  const MAX_VISIBLE = 5;
  const isCapped = !expanded && groupedIssues.length > MAX_VISIBLE;
  const displayedGrouped = isCapped ? groupedIssues.slice(0, MAX_VISIBLE) : groupedIssues;

  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 overflow-hidden text-sm">
      {rawIssues.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-3 py-2 text-xs text-muted-foreground bg-muted/40">
          <span className="font-semibold text-foreground/80">
            {t("Issues found ({0})", { "0": rawIssues.length })}
          </span>
          {rawIssues.length > groupedIssues.length && (
            <button
              type="button"
              onClick={() => setShowDetailedRows((prev) => !prev)}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {showDetailedRows
                ? t("Show summary view")
                : t("View all {0} rows", { "0": rawIssues.length })}
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/40 text-xs font-semibold text-muted-foreground">
              <th className="p-2.5">{t("Sheet")}</th>
              <th className="p-2.5">{t("Excel row")}</th>
              <th className="p-2.5">{t("Field")}</th>
              <th className="p-2.5">{t("Action needed")}</th>
            </tr>
          </thead>
          <tbody>
            {showDetailedRows
              ? rawIssues.map((issue, index) => (
                  <tr
                    key={index}
                    className="border-b border-border/30 last:border-0 align-top hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-2.5 font-medium">{issue.sheet}</td>
                    <td className="p-2.5 text-muted-foreground">
                      {issue.row || t("Previous import")}
                    </td>
                    <td className="p-2.5 font-mono text-xs">{issue.field}</td>
                    <td className="p-2.5 text-destructive/90 dark:text-red-400 font-medium">
                      {t(issue.reason)}
                    </td>
                  </tr>
                ))
              : displayedGrouped.map((issue) => (
                  <tr
                    key={issue.key}
                    className="border-b border-border/30 last:border-0 align-top hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-2.5 font-medium">{issue.sheet}</td>
                    <td className="p-2.5 text-muted-foreground">{issue.rowDisplay}</td>
                    <td className="p-2.5 font-mono text-xs">{issue.field}</td>
                    <td className="p-2.5 text-destructive/90 dark:text-red-400 font-medium">
                      {t(issue.reason)}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!showDetailedRows && groupedIssues.length > MAX_VISIBLE && (
        <div className="border-t border-border/40 p-2 text-center bg-muted/20">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {expanded
              ? t("Show fewer issues")
              : t("Show all {0} issues", { "0": groupedIssues.length })}
          </button>
        </div>
      )}
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
            {t("Excel workbook (.xlsx)")}
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
          <dt className="text-muted-foreground">{t("Available datasets")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {successfulImports.length} {t("saved versions")}
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
