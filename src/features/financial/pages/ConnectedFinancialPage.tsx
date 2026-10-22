import { useTranslation } from "@/lib/i18n";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { usePlatform, useSnapshot } from "@/app/providers";
import { api } from "@/lib/apiClient";
import type { FinancialClient, FinancialSnapshot, Trends } from "../types";
import { FinancialPage } from "./FinancialPage";

const client: FinancialClient = {
  summary: (businessId, period, signal) =>
    api<FinancialSnapshot>(
      `/api/v1/financial/summary?${new URLSearchParams({ business_id: businessId, start: period.start, end: period.end })}`,
      { signal },
    ),
  trends: (businessId, end, signal) =>
    api<Trends>(
      `/api/v1/financial/trends?${new URLSearchParams({ business_id: businessId, end, months: "3" })}`,
      { signal },
    ),
};

export function ConnectedFinancialPage() {
  const { t } = useTranslation();

  const { business } = usePlatform();
  const snapshot = useSnapshot();
  if (snapshot.isPending) return <LoadingAnimation label="Loading current financial records…" />;
  if (snapshot.isError) return <p role="alert">{t(snapshot.error.message)}</p>;
  if (snapshot.data.business_id !== business.id)
    return <p role="alert">{t("Business records are changing. Refresh to continue.")}</p>;
  return (
    <FinancialPage
      key={business.id}
      client={client}
      businessId={business.id}
      businessName={business.name}
      importBatchId={null}
      sourceVersion={snapshot.data.source_version}
      synthetic={snapshot.data.synthetic ?? false}
      dataRefreshing={snapshot.isFetching}
      onRefresh={async () => {
        await snapshot.refetch();
      }}
    />
  );
}
