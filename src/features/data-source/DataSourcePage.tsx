import { useTranslation } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Loading, usePlatform } from "@/app/providers";
import { NextStepCard } from "@/components/NextStepCard";
import { api, businessPath } from "@/lib/apiClient";
import type { SyncStatus as Status } from "@/lib/contracts";
import { ExcelUpload } from "./ExcelUpload";
import { OneDriveConnect } from "./OneDriveConnect";
import { SyncStatus } from "./SyncStatus";
export function DataSourcePage() {
  const { t } = useTranslation();

  const { business } = usePlatform();
  const query = useQuery({
    queryKey: ["sync-status", business.id],
    queryFn: () => api<Status>(businessPath("sync-status", business.id)),
  });
  if (query.isPending) return <Loading />;
  if (query.isError) return <p role="alert">{t(query.error.message)}</p>;
  const hasConfirmedImport =
    !query.isFetching &&
    Boolean(query.data.source_id) &&
    query.data.source_version > 0 &&
    Boolean(query.data.last_import_at);
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
          {t("Business settings")}
        </p>
        <h1 className="text-3xl font-bold">{t("Your data starts here.")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("One workbook for")} {business.name}
          {t(". Financial pages refresh after each successful import.")}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ExcelUpload key={business.id} maxBytes={query.data.max_upload_bytes} />
        <OneDriveConnect status={query.data} />
      </div>
      {hasConfirmedImport && (
        <NextStepCard
          description="Your business records are ready. Analyze your financial data to discover business issues and recommended next actions."
          action="Get AI Recommendations"
          to="/ai"
        />
      )}
      <SyncStatus status={query.data} />
    </div>
  );
}
