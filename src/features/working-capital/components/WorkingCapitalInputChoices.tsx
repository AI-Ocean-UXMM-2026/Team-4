import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "@/lib/i18n";
import type { InventoryRisk } from "../hooks/useWorkingCapital";
import { useWorkingCapitalManualInputs, type ManualWorkingCapitalInputs } from "../manualInputs";

const exampleDefaults: ManualWorkingCapitalInputs = {
  availableCashMmk: null,
  supplierLeadDays: 7,
  mandatoryMonthlyPaymentsMmk: "0",
  monthlyEssentialCostsMmk: "",
  protectedReserveMmk: "0",
  dedicatedReserveMmk: "0",
  stockLevels: {},
};

export function WorkingCapitalInputChoices({
  inventory,
  recordedCashMmk,
  complete,
}: {
  inventory: InventoryRisk[];
  recordedCashMmk: string | number | null;
  complete: boolean;
}) {
  const { t } = useTranslation();
  const { inputs, save } = useWorkingCapitalManualInputs();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ManualWorkingCapitalInputs>(inputs ?? exampleDefaults);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amounts = [
      draft.mandatoryMonthlyPaymentsMmk,
      draft.protectedReserveMmk,
      draft.dedicatedReserveMmk,
    ];
    if (draft.monthlyEssentialCostsMmk) amounts.push(draft.monthlyEssentialCostsMmk);
    if (draft.availableCashMmk !== null) amounts.push(draft.availableCashMmk);
    const stock = Object.values(draft.stockLevels);
    if (
      !Number.isInteger(draft.supplierLeadDays) ||
      draft.supplierLeadDays < 0 ||
      draft.supplierLeadDays > 365 ||
      amounts.some(
        (value) => !/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 1_000_000_000_000,
      ) ||
      stock.some((value) => !/^\d+(\.\d{1,3})?$/.test(value) || Number(value) > 1_000_000_000_000)
    ) {
      setError(
        t(
          "Enter non-negative MMK amounts (up to 2 decimals), stock quantities (up to 3 decimals), and a lead time from 0 to 365 days.",
        ),
      );
      return;
    }
    const monthlyEssentialCostsMmk =
      draft.monthlyEssentialCostsMmk || draft.mandatoryMonthlyPaymentsMmk;
    if (Number(monthlyEssentialCostsMmk) < Number(draft.mandatoryMonthlyPaymentsMmk)) {
      setError(t("Monthly essential costs must include at least your mandatory monthly payments."));
      return;
    }
    save({ ...draft, availableCashMmk: draft.availableCashMmk || null, monthlyEssentialCostsMmk });
    setError("");
    setOpen(false);
  }

  return (
    <section
      className={complete ? "space-y-3" : "bf-card space-y-4 border-primary/30 bg-primary/5"}
      aria-label={t("Data input and configuration")}
    >
      {!complete ? (
        <>
          <div>
            <h2 className="text-lg font-bold">{t("Complete your working capital inputs")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                "Choose how to supply missing planning information. Manual entries are assumptions and do not change your imported records.",
              )}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/data-source"
              className="rounded-2xl border border-primary bg-primary p-5 text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="block font-semibold">{t("Update via Excel File")}</span>
              <span className="mt-2 block text-sm">
                {t("Upload or sync your updated Excel workbook via OneDrive.")}
              </span>
            </Link>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="working-capital-manual-form"
              onClick={() => {
                setDraft(inputs ?? exampleDefaults);
                setError("");
                setOpen((current) => !current);
              }}
              className="rounded-2xl border border-primary bg-primary p-5 text-left text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="block font-semibold">{t("Input Data Manually")}</span>
              <span className="mt-2 block text-sm">
                {t("Quickly fill in the missing variables directly in the app.")}
              </span>
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="bf-button"
          aria-expanded={open}
          aria-controls="working-capital-manual-form"
          onClick={() => {
            setDraft(inputs ?? exampleDefaults);
            setError("");
            setOpen((current) => !current);
          }}
        >
          {t("Edit planning inputs")}
        </button>
      )}
      {inputs && !complete && (
        <p className="text-xs text-primary">
          {t("Source: Manual Entry")} · {t("Saved in this browser for this workbook version")}
        </p>
      )}
      {open && (
        <form
          id="working-capital-manual-form"
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-primary/20 bg-background p-5"
        >
          <p className="text-xs text-muted-foreground">
            {t(
              "Suggested starting values are 7 days and 0 MMK. Replace them with your real planning assumptions before saving. Values are local to this browser and workbook version.",
            )}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {recordedCashMmk == null && (
              <label className="space-y-1 text-sm font-medium">
                <span className="block">{t("Available cash for purchases (MMK)")}</span>
                <input
                  className="w-full rounded-xl border bg-background px-3 py-2"
                  type="number"
                  min="0"
                  max="1000000000000"
                  step="0.01"
                  placeholder="e.g. 5000000"
                  value={draft.availableCashMmk ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, availableCashMmk: event.target.value || null })
                  }
                />
                <span className="block text-xs font-normal text-muted-foreground">
                  {t(
                    "Optional if Excel cannot calculate cash. Enter your current available cash as a planning assumption, not a recorded balance.",
                  )}
                </span>
              </label>
            )}
            <label className="space-y-1 text-sm font-medium">
              <span className="block">{t("Supplier lead time (days)")}</span>
              <input
                className="w-full rounded-xl border bg-background px-3 py-2"
                type="number"
                min="0"
                max="365"
                step="1"
                required
                placeholder="e.g. 7 days"
                value={draft.supplierLeadDays}
                onChange={(event) =>
                  setDraft({ ...draft, supplierLeadDays: Number(event.target.value) })
                }
              />
              <span className="block text-xs font-normal text-muted-foreground">
                {t(
                  "Days between placing an order and receiving stock; applied to all listed products.",
                )}
              </span>
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span className="block">{t("Mandatory / fixed monthly payments (MMK)")}</span>
              <input
                className="w-full rounded-xl border bg-background px-3 py-2"
                type="number"
                min="0"
                max="1000000000000"
                step="0.01"
                required
                placeholder="e.g. 500000"
                value={draft.mandatoryMonthlyPaymentsMmk}
                onChange={(event) =>
                  setDraft({ ...draft, mandatoryMonthlyPaymentsMmk: event.target.value })
                }
              />
              <span className="block text-xs font-normal text-muted-foreground">
                {t("Amount to set aside for the next month before planning purchases.")}
              </span>
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span className="block">{t("Protected cash reserve target (MMK)")}</span>
              <input
                className="w-full rounded-xl border bg-background px-3 py-2"
                type="number"
                min="0"
                max="1000000000000"
                step="0.01"
                required
                placeholder="e.g. 300000"
                value={draft.protectedReserveMmk}
                onChange={(event) =>
                  setDraft({ ...draft, protectedReserveMmk: event.target.value })
                }
              />
              <span className="block text-xs font-normal text-muted-foreground">
                {t("Cash you want to keep untouched when estimating a purchasing budget.")}
              </span>
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span className="block">{t("Monthly essential costs (MMK)")}</span>
              <input
                className="w-full rounded-xl border bg-background px-3 py-2"
                type="number"
                min="0"
                max="1000000000000"
                step="0.01"
                placeholder="e.g. 800000"
                value={draft.monthlyEssentialCostsMmk}
                onChange={(event) =>
                  setDraft({ ...draft, monthlyEssentialCostsMmk: event.target.value })
                }
              />
              <span className="block text-xs font-normal text-muted-foreground">
                {t(
                  "Include mandatory payments and other essential costs. Leave blank to use mandatory payments as the minimum.",
                )}
              </span>
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span className="block">{t("Current dedicated reserve (MMK)")}</span>
              <input
                className="w-full rounded-xl border bg-background px-3 py-2"
                type="number"
                min="0"
                max="1000000000000"
                step="0.01"
                required
                placeholder="e.g. 300000"
                value={draft.dedicatedReserveMmk}
                onChange={(event) =>
                  setDraft({ ...draft, dedicatedReserveMmk: event.target.value })
                }
              />
              <span className="block text-xs font-normal text-muted-foreground">
                {t(
                  "Cash already set aside for emergencies; this is not your total cash balance or your target.",
                )}
              </span>
            </label>
          </div>
          {inventory.length > 0 && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold">
                {t("Stock levels / inventory adjustments (optional)")}
              </legend>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Leave blank to use the imported stock. Enter a quantity to override it for planning only.",
                )}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {inventory.map((item) => (
                  <label key={item.product_id} className="space-y-1 text-sm">
                    <span className="block">
                      {item.name} · {t("Imported")}: {item.current_stock_qty}
                    </span>
                    <input
                      className="w-full rounded-xl border bg-background px-3 py-2"
                      type="number"
                      min="0"
                      max="1000000000000"
                      step="0.001"
                      placeholder={String(item.current_stock_qty)}
                      value={draft.stockLevels[item.product_id] ?? ""}
                      onChange={(event) => {
                        const stockLevels = { ...draft.stockLevels };
                        if (event.target.value === "") delete stockLevels[item.product_id];
                        else stockLevels[item.product_id] = event.target.value;
                        setDraft({ ...draft, stockLevels });
                      }}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button type="submit" className="bf-button">
              {t("Save & Apply")}
            </button>
            <button type="button" className="bf-button-secondary" onClick={() => setOpen(false)}>
              {t("Cancel")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
