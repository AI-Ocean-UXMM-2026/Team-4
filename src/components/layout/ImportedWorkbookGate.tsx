import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "@/lib/i18n";

const dataPages = new Set(["/", "/financial", "/working-capital", "/ai"]);

export function ImportedWorkbookGate({ sourceVersion, path, children }: {
  sourceVersion: number; path: string; children: ReactNode;
}) {
  const { t } = useTranslation();
  const page = path.replace(/\/+$/, "") || "/";
  // The saved import version belongs to the active business. The file picker
  // only stages a new upload and must never control visibility of saved data.
  if (sourceVersion > 0 || !dataPages.has(page)) return <>{children}</>;
  return (
    <section className="bf-card space-y-4" aria-label={t("No workbook imported yet")}>
      <h1 className="text-xl font-semibold">{t("No workbook imported yet")}</h1>
      <p className="text-sm text-muted-foreground">{t("Import an Excel workbook for this business to see financial data, loan records and analysis. Selecting a file alone does not import it.")}</p>
      <Link to="/data-source" className="bf-button inline-flex">{t("Import Excel workbook")}</Link>
    </section>
  );
}
