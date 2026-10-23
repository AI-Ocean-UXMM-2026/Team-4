import { useTranslation } from "@/lib/i18n";
import { useState } from "react";
import { Cloud } from "lucide-react";
import { usePlatform } from "@/app/providers";
import { api, businessPath } from "@/lib/apiClient";
import type { ImportResult, SyncStatus, WorkbookFile } from "@/lib/contracts";
export function OneDriveConnect({ status }: { status: SyncStatus }) {
  const { t } = useTranslation();

  const { business, imported } = usePlatform();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<WorkbookFile[]>([]);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await operation();
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "OneDrive request failed");
    } finally {
      setBusy(false);
      await imported();
    }
  };
  const browse = async (folder?: string) => {
    const path =
      businessPath("files", business.id) +
      (folder ? `&folder_id=${encodeURIComponent(folder)}` : "");
    setFiles((await api<{ items: WorkbookFile[] }>(path)).items);
  };
  return (
    <section className="bf-card">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("OneDrive connection")}</h2>
        <Cloud className="text-primary" size={22} />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {status.graph_enabled
          ? status.linked
            ? t("A cloud workbook is linked. Sync Now imports its latest saved version.")
            : t("Connect an approved Microsoft account and choose your workbook.")
          : t("School Microsoft access is not configured. Manual upload is ready to use.")}
      </p>
      <p className="mb-5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        {t(
          "OneDrive must finish uploading your Excel changes before Shay Sett can read them. Sync Now checks the cloud copy. Local-only changes require re-upload.",
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={!status.graph_enabled || busy}
          className="bf-button-secondary"
          onClick={() =>
            void run(async () => {
              const result = await api<{ authorization_url: string }>(
                `/api/v1/auth/microsoft/connect?business_id=${encodeURIComponent(business.id)}`,
              );
              window.location.assign(result.authorization_url);
            })
          }
        >
          {status.connected ? t("Reconnect Microsoft") : t("Connect Microsoft")}
        </button>
        {status.connected && (
          <button
            disabled={busy}
            className="bf-button-secondary"
            onClick={() => void run(() => browse())}
          >
            {t("Choose workbook")}
          </button>
        )}
        <button
          className="bf-button"
          disabled={!status.linked || busy}
          onClick={() =>
            void run(async () => {
              const result = await api<ImportResult>(businessPath("sync-now", business.id), {
                method: "POST",
              });
              setMessage(
                result.status === "up_to_date"
                  ? "Cloud version is already up to date."
                  : `Cloud workbook imported. ${result.row_counts.updated || 0} rows updated.`,
              );
            })
          }
        >
          {busy ? t("Working…") : t("Sync Now")}
        </button>
      </div>
      {files.length > 0 && (
        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3">
          <button className="bf-button-link block text-sm" onClick={() => void run(() => browse())}>
            {t("OneDrive root")}
          </button>
          {files.map((file) => (
            <button
              key={file.id}
              disabled={busy}
              className="bf-button-quiet block w-full p-2 text-left text-sm"
              onClick={() =>
                void run(async () => {
                  if (file.is_folder) {
                    await browse(file.id);
                    return;
                  }
                  await api(businessPath("link", business.id), {
                    method: "POST",
                    body: JSON.stringify({ drive_id: file.drive_id, item_id: file.id }),
                  });
                  setFiles([]);
                  setMessage(`${file.name} linked. Click Sync Now to import.`);
                })
              }
            >
              {file.is_folder ? t("Folder: ") : t("Workbook: ")}
              {file.name}
            </button>
          ))}
        </div>
      )}
      {status.connected && (
        <button
          disabled={busy}
          className="bf-button-link mt-5 block text-xs"
          onClick={() =>
            void run(async () => {
              await api(businessPath("link", business.id), { method: "DELETE" });
              setFiles([]);
              setMessage(
                "Disconnected. Imported records retained. Revoke app consent in Microsoft to revoke the grant.",
              );
            })
          }
        >
          {t("Disconnect OneDrive")}
        </button>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
