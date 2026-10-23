import { useTranslation } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { usePlatform } from "@/app/providers";
import { api, ApiError, businessPath } from "@/lib/apiClient";
import type { ImportResult } from "@/lib/contracts";
import { Issues } from "./SyncStatus";
export function ExcelUpload({ maxBytes }: { maxBytes: number }) {
  const { t } = useTranslation();

  const { business, imported } = usePlatform();
  const [file, setFile] = useState<File | null>(null);
  const [lastWorkbook, setLastWorkbook] = useState("");
  useEffect(() => {
    setFile(null);
    setResult(null);
    setError("");
    try {
      setLastWorkbook(localStorage.getItem(`bizflow-last-workbook:${business.id}`) || "");
    } catch {
      setLastWorkbook("");
    }
  }, [business.id]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
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
  const predatingError = result?.errors.some(
    (issue) => issue.reason === "Transaction predates the opening date",
  );

  return (
    <section className="bf-card h-full">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("Upload Excel workbook")}</h2>
        <Upload size={20} className="text-primary" />
      </div>
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
      <p aria-live="polite" className="mt-2 break-all text-sm font-medium">
        {file ? <>{t("Selected file:")} {file.name}</> : lastWorkbook ? <>{t("Last imported workbook:")} {lastWorkbook}</> : t("No workbook selected. Browse, paste or drop an .xlsx file here.")}
      </p>
      {!file && lastWorkbook && <p className="mt-2 text-sm text-muted-foreground">{t("Select the workbook again to import changes. Your previously imported data is saved.")}</p>}
      </div>
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
              const uploadResult = await api<ImportResult>(uploadPath, {
                    method: "POST",
                    body: form,
                  });
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

      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {t(error)}
        </p>
      )}
      {predatingError && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
          <p className="font-semibold text-amber-700 dark:text-amber-400">
            {t("Transactions predate the opening date")}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t("Review the opening date in Settings and the dates of records already imported for this business.")}
          </p>
        </div>
      )}
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
