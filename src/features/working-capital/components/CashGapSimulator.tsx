import { useTranslation } from "@/lib/i18n";
import { useState } from "react";
import { RangeField, ScenarioResult } from "./ScenarioUI";

type Response = { result: Record<string, unknown> };

export function CashGapSimulator({
  simulate,
}: {
  simulate: <T>(type: string, assumptions: Record<string, unknown>) => Promise<T>;
}) {
  const { t } = useTranslation();

  const [dio, setDio] = useState(30);
  const [dso, setDso] = useState(12);
  const [extension, setExtension] = useState(15);
  const [result, setResult] = useState<Response | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await simulate<Response>("cash_gap", {
          dio_days: dio,
          dso_days: dso,
          dpo_days: 25,
          supplier_extension_days: extension,
          demo_estimate: true,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not calculate this scenario.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="bf-card space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">{t("Step 2")}</p>
        <h2 className="mt-1 text-xl font-bold">{t("Explore the cash gap")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "Change example day counts to compare cash conversion cycles. The 25 supplier payment days are an illustrative assumption; results are in days, not MMK.",
          )}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <RangeField
          label={t("Inventory days (DIO)")}
          value={dio}
          min={0}
          max={180}
          unit=" days"
          onChange={setDio}
        />
        <RangeField
          label={t("Collection days (DSO)")}
          value={dso}
          min={0}
          max={180}
          unit=" days"
          onChange={setDso}
        />
        <RangeField
          label={t("Supplier extension")}
          value={extension}
          min={0}
          max={90}
          unit=" days"
          onChange={setExtension}
        />
      </div>
      <button className="bf-button" disabled={pending} onClick={() => void run()}>
        {pending ? t("Comparing…") : t("Compare projected cycle")}
      </button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      )}
      <ScenarioResult response={result} />
    </section>
  );
}
