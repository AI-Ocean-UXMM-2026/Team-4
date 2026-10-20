import { useQuery } from "@tanstack/react-query";
import { Loading, usePlatform } from "@/app/providers";
import { api, businessPath } from "@/lib/apiClient";
import type { SyncStatus as Status } from "@/lib/contracts";
import { ExcelUpload } from "./ExcelUpload";
import { OneDriveConnect } from "./OneDriveConnect";
import { SyncStatus } from "./SyncStatus";
export function DataSourcePage() {
  const { business } = usePlatform();
  const query = useQuery({
    queryKey: ["sync-status", business.id],
    queryFn: () => api<Status>(businessPath("sync-status", business.id)),
  });
  if (query.isPending) return <Loading />;
  if (query.isError) return <p role="alert">{query.error.message}</p>;
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
          Business settings
        </p>
        <h1 className="text-3xl font-bold">Your data starts here.</h1>
        <p className="mt-2 text-muted-foreground">
          One workbook for {business.name}. Financial pages refresh after each successful import.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ExcelUpload maxBytes={query.data.max_upload_bytes} />
        <OneDriveConnect status={query.data} />
      </div>
      <SyncStatus status={query.data} />
    </div>
  );
}
