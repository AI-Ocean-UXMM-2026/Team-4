import { useTranslation } from "@/lib/i18n";
import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { usePlatform } from "@/app/providers";
import { api, ApiError, businessPath } from "@/lib/apiClient";
import type { ImportResult } from "@/lib/contracts";
import { Issues } from "./SyncStatus";
import { WorkbookBusinessHelp } from "./WorkbookBusinessHelp";
import loanCatalog from "../../../shared/contracts/loan-products.json";
export function ExcelUpload({ maxBytes }: { maxBytes: number }) {
  const { t } = useTranslation();

  const { business, imported } = usePlatform();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [replaceOmitted, setReplaceOmitted] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
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
      <details className="mb-5 rounded-xl border p-4 text-sm">
        <summary className="cursor-pointer font-semibold">{t("Import an existing bank loan")}</summary>
        <p className="mt-3 text-muted-foreground">{t("In Loans, supply bank_id, loan_product_id, loan_product, annual_rate_pct, term_months, first_payment_date and payment_frequency together. Use the signed agreement rate: enter 12 for 12% annually.")}</p>
        <p className="mt-2 text-muted-foreground">{t("Monthly reducing-balance estimates require the first payment one month after disbursement. Other repayment arrangements need the lender schedule.")}</p>
        <ul className="mt-3 space-y-2">
          {loanCatalog.banks.map(bank => (
            <li key={bank.id}>
              <strong>{bank.name} ({bank.id})</strong>
              <ul className="ml-5 list-disc">
                {bank.products.map(product => <li key={product.id}>{product.name} — {product.id}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </details>
      <label className="block rounded-xl border-2 border-dashed bg-secondary/30 p-6">
        <span className="mb-3 block text-sm font-semibold">
          {t("Choose .xlsx file · up to")} {Math.round(maxBytes / 1024 / 1024)} {t("MB")}
        </span>
        <input
          aria-label={t("Excel workbook")}
          type="file"
          accept=".xlsx"
          disabled={busy}
          className="bf-file-input block w-full text-sm"
          onChange={(event) => {
            setError("");
            setResult(null);
            const next = event.target.files?.[0] || null;
            if (next && (!next.name.toLowerCase().endsWith(".xlsx") || next.size > maxBytes)) {
              setFile(null);
              setError("Choose an .xlsx file within the size limit.");
              return;
            }
            setFile(next);
          }}
        />
      </label>
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
              setResult(
                await api<ImportResult>(
                  replaceOmitted ? `${uploadPath}&replace_omitted=true` : uploadPath,
                  {
                    method: "POST",
                    body: form,
                  },
                ),
              );
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
