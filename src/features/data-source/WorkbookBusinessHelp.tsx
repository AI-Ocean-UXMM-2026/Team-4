import { useState } from "react";
import { Copy } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { Business } from "@/lib/contracts";

export function WorkbookBusinessHelp({ business }: { business: Business }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  return (
    <section className="mt-4 space-y-3 rounded-xl border border-primary/30 bg-secondary/50 p-4">
      <h3 className="font-semibold">{t("This workbook uses a different business ID.")}</h3>
      <p className="text-sm text-muted-foreground">
        {t("You are importing into {0}.", { "0": business.name })}{" "}
        {t(
          "If this is your workbook, replace business_id in Settings and every populated sheet with the ID below. Save the file, then upload it again. Keep the other row IDs unchanged.",
        )}
      </p>
      <label className="block text-sm font-semibold">
        {t("Your business ID")}
        <input
          className="bf-input mt-2 w-full font-mono text-sm"
          value={business.id}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <button
        type="button"
        className="bf-button-secondary inline-flex items-center gap-2"
        onClick={async () => {
          setCopied(false);
          setCopyFailed(false);
          try {
            await navigator.clipboard.writeText(business.id);
            setCopied(true);
          } catch {
            setCopyFailed(true);
          }
        }}
      >
        <Copy size={16} aria-hidden="true" />
        {t("Copy business ID")}
      </button>
      <p role="status" className="text-sm text-muted-foreground">
        {copied && t("Business ID copied")}
        {copyFailed && t("Select the business ID above and copy it manually.")}
      </p>
      <p className="text-sm text-muted-foreground">
        {t(
          "Starting a new workbook? Download the template above. It already contains your business ID in Settings.",
        )}
      </p>
    </section>
  );
}
