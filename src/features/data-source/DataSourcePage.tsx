import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loading, usePlatform } from "@/app/providers";
import { api, businessPath } from "@/lib/apiClient";
import type { SyncStatus as Status } from "@/lib/contracts";
import { ExcelUpload } from "./ExcelUpload";
import { OneDriveConnect } from "./OneDriveConnect";
import { SyncStatus } from "./SyncStatus";
export function DataSourcePage() {
  const { business, config, imported } = usePlatform();
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);
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
      {config.allow_demo_reset && (
        <section className="rounded-xl border p-5">
          <h2 className="font-semibold">Reset synthetic demo</h2>
          <p className="my-2 text-sm text-muted-foreground">
            Restore {business.name} to its sample workbook. This replaces imported demo records for
            this business.
          </p>
          <button
            className="bf-button-secondary"
            disabled={resetting}
            onClick={async () => {
              setResetting(true);
              setResetError("");
              try {
                await api(`/api/v1/demo/reset?business_id=${encodeURIComponent(business.id)}`, {
                  method: "POST",
                });
                await imported();
              } catch (failure) {
                setResetError(failure instanceof Error ? failure.message : "Reset failed");
              } finally {
                setResetting(false);
              }
            }}
          >
            {resetting ? "Restoring…" : "Restore sample data"}
          </button>
          {resetError && (
            <p role="alert" className="mt-3 text-destructive">
              {resetError}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
