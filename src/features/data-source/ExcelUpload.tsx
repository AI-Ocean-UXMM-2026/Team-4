import { useTranslation } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { usePlatform } from "@/app/providers";
import { api, ApiError, businessPath } from "@/lib/apiClient";
import type { ImportResult } from "@/lib/contracts";
import { Issues } from "./SyncStatus";
import { WorkbookBusinessHelp } from "./WorkbookBusinessHelp";
export function ExcelUpload({ maxBytes }: { maxBytes: number }) {
  const { t } = useTranslation();

  const { business, imported } = usePlatform();
  const [file, setFile] = useState<File | null>(null);
  const [lastWorkbook, setLastWorkbook] = useState("");
  useEffect(() => {
    setFile(null);
    setResult(null);
    setError("");
    setReplaceOmitted(false);
    try {
      setLastWorkbook(localStorage.getItem(`bizflow-last-workbook:${business.id}`) || "");
    } catch {
      setLastWorkbook("");
    }
  }, [business.id]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [replaceOmitted, setReplaceOmitted] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const chooseFile = (next: File | null) => {
    if (busy) return;
    setError(""); setResult(null);
    if (next && (!next.name.toLowerCase().endsWith(".xlsx") || next.size > maxBytes)) {
      setFile(null); setError("Choose an .xlsx file within the size limit."); return;
    }
    setFile(next);
  };
  const businessMismatch = result?.errors.some(
    (issue) => issue.field === "business_id" && issue.reason === "Row belongs to another business",
  );
  const download = async () => {
    try {
      const blob = await api<Blob>(businessPath("template", business.id));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${business.id}-template.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Download failed");
    }
  };
  return (
    <section className="bf-card">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("Upload Excel workbook")}</h2>
        <Upload size={20} className="text-primary" />
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        {t(
          "Edit your workbook, save it, then re-upload. Keep the same row IDs to update entries once. Rows omitted from an upload are kept unless you choose full replacement.",
        )}
      </p>
      <p className="mb-5 text-sm text-muted-foreground">
        {t("Before importing, complete one Settings row: business_id, business_name, currency (MMK), opening_date and opening_cash_mmk. The blank template contains no financial data. Loans and LoanPayments sheets are optional.")}
      </p>
      <div role="group" aria-label={t("Paste Excel file here")} tabIndex={0}
        className="block rounded-xl border-2 border-dashed bg-secondary/30 p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          event.preventDefault();
          const dropped = event.dataTransfer.files[0];
          if (dropped) chooseFile(dropped);
        }}
        onPaste={event => {
          if (busy) return;
          event.preventDefault();
          const pasted = event.clipboardData.files[0] || Array.from(event.clipboardData.items).find(item => item.kind === "file")?.getAsFile();
          if (pasted) chooseFile(pasted);
          else setError("Copy the .xlsx file itself, then paste here. Copied cells and file paths are not supported.");
        }}>
      <div className="block">
        <span className="mb-3 block text-sm font-semibold">
          {t("Choose .xlsx file · up to")} {Math.round(maxBytes / 1024 / 1024)} {t("MB")}
        </span>
        <input
          ref={fileInput}
          aria-label={t("Excel workbook")}
          type="file"
          accept=".xlsx"
          disabled={busy}
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) chooseFile(selected);
            event.target.value = "";
          }}
        />
        <button type="button" disabled={busy} className="bf-button-secondary" onClick={() => fileInput.current?.click()}>
          {t(file ? "Change file" : "Browse files")}
        </button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{t("Copy an .xlsx file, click this area, then press Ctrl+V to paste.")}</p>
      <p aria-live="polite" className="mt-2 break-all text-sm font-medium">
        {file ? <>{t("Selected file:")} {file.name}</> : lastWorkbook ? <>{t("Last imported workbook:")} {lastWorkbook}</> : t("No workbook selected. Browse, paste or drop an .xlsx file here.")}
      </p>
      {!file && lastWorkbook && <p className="mt-2 text-sm text-muted-foreground">{t("Select the workbook again to import changes. Your previously imported data is saved.")}</p>}
      </div>
      <label className="mt-4 flex items-start gap-3 rounded-xl border p-3 text-sm">
        <input
          type="checkbox"
          checked={replaceOmitted}
          disabled={busy}
          onChange={(event) => setReplaceOmitted(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="block font-semibold">This workbook is a complete replacement</span>
          <span className="text-muted-foreground">
            Records missing from this file will be removed from current reports. Their import
            history is retained.
          </span>
        </span>
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="bf-button"
          disabled={!file || busy}
          onClick={async () => {
            if (!file) return;
            setBusy(true);
            setError("");
            setResult(null);
            try {
              const form = new FormData();
              form.append("file", file);
              const uploadPath = businessPath("upload", business.id);
              const uploadResult = await api<ImportResult>(
                  replaceOmitted ? `${uploadPath}&replace_omitted=true` : uploadPath,
                  {
                    method: "POST",
                    body: form,
                  },
                );
              setResult(uploadResult);
              if (uploadResult.status !== "failed") {
                setLastWorkbook(file.name);
                try {
                  localStorage.setItem(`bizflow-last-workbook:${business.id}`, file.name);
                } catch { /* Import still succeeds when browser storage is unavailable. */ }
              }
              await imported();
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : "Import failed");
              if (failure instanceof ApiError && failure.code === "WORKBOOK_INVALID")
                setResult(failure.details[0] as ImportResult);
              await imported();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? t("Validating and importing…") : t("Import workbook")}
        </button>
        <button
          className="bf-button-secondary inline-flex items-center gap-2"
          onClick={() => void download()}
        >
          <Download size={16} />
          {t("Download template")}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {t(error)}
        </p>
      )}
      {businessMismatch && <WorkbookBusinessHelp business={business} />}
      {result && (
        <div aria-live="polite" className="mt-4 text-sm">
          {result.status !== "failed" && (
            <p className="font-semibold text-primary">
              {result.status === "up_to_date"
                ? t("Already up to date. No duplicate rows added.")
                : t("Imported: {0} added, {1} updated, {2} unchanged, {3} removed.", {
                    "0": result.row_counts.inserted || 0,
                    "1": result.row_counts.updated || 0,
                    "2": result.row_counts.unchanged || 0,
                    "3": result.row_counts.removed || 0,
                  })}
            </p>
          )}
          <Issues result={result} />
        </div>
      )}
    </section>
  );
}
