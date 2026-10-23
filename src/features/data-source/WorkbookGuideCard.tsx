import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { usePlatform } from "@/app/providers";
import { api, businessPath } from "@/lib/apiClient";
import {
  BookOpen,
  Download,
} from "lucide-react";

export function WorkbookGuideCard() {
  const { t } = useTranslation();
  const { business } = usePlatform();
  const [downloading, setDownloading] = useState(false);

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const blob = await api<Blob>(businessPath("template", business.id));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "shay-sett-template.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="bf-card h-full">
      <div>
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold">{t("Workbook Guidelines")}</h2>
              <p className="text-xs text-muted-foreground">
                {t("Structure your Excel file for accurate analysis")}
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={downloading}
          onClick={() => void downloadTemplate()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border/80 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          title={t("Download template")}
        >
          <Download size={13} />
          <span>{t("Download template")}</span>
        </button>

        {/* Sheet Coverage Breakdown */}
        <div className="mt-4 space-y-3">
          <div role="group" aria-label={t("Core Sheets (Required)")}>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("Core Sheets (Required)")}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-lg bg-muted px-2.5 py-1 font-medium text-foreground">
                Settings
              </span>
              <span className="rounded-lg bg-muted px-2.5 py-1 font-medium text-foreground">
                Products
              </span>
              <span className="rounded-lg bg-muted px-2.5 py-1 font-medium text-foreground">
                Sales
              </span>
              <span className="rounded-lg bg-muted px-2.5 py-1 font-medium text-foreground">
                CustomerReceipts
              </span>
              <span className="rounded-lg bg-muted px-2.5 py-1 font-medium text-foreground">
                Purchases
              </span>
              <span className="rounded-lg bg-muted px-2.5 py-1 font-medium text-foreground">
                SupplierPayments
              </span>
              <span className="rounded-lg bg-muted px-2.5 py-1 font-medium text-foreground">
                Expenses
              </span>
            </div>
          </div>

          <div role="group" aria-label={t("Optional Sheets")}>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("Optional Sheets")}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-lg border border-border/70 px-2 py-0.5 text-muted-foreground">
                Loans
              </span>
              <span className="rounded-lg border border-border/70 px-2 py-0.5 text-muted-foreground">
                LoanPayments
              </span>
              <span className="rounded-lg border border-border/70 px-2 py-0.5 text-muted-foreground">
                CashBalances
              </span>
              <span className="rounded-lg border border-border/70 px-2 py-0.5 text-muted-foreground">
                CashAdjustments
              </span>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
