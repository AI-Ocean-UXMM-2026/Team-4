import { useTranslation } from "@/lib/i18n";
import type { ReadinessCategory } from "../types";

export function ReadinessChecklist({ items }: { items: ReadinessCategory[] }) {
  const { t } = useTranslation();

  return (
    <section className="space-y-4" aria-label={t("Prepare for credit")}>
      <p className="text-sm text-muted-foreground">
        {t("Imported record presence does not verify a lender document.")}
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        {items.map((item) => (
          <article
            key={item.category}
            className="credit-record-folder relative min-w-0 rounded-md border border-primary/25 bg-card p-5 sm:p-6"
          >
            <svg
              viewBox="0 0 20 20"
              className="pointer-events-none absolute right-0 top-0 h-5 w-5 text-primary/30"
              aria-hidden="true"
            >
              <path d="M0 0H20V20Z" fill="var(--background)" />
              <path
                d="M0 0V15Q0 20 5 20H20L0 0Z"
                fill="var(--card)"
                stroke="currentColor"
                strokeWidth="0.75"
              />
            </svg>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <h3 className="min-w-0 flex-1 basis-48 text-sm font-semibold leading-7">
                {t(item.title)}
              </h3>
              <span className="shrink-0 rounded-md bg-secondary/60 px-2 py-0.5 text-[11px] leading-6 text-muted-foreground">
                {t(item.status.replaceAll("_", " "))}
              </span>
            </div>
            <div aria-hidden="true" className="mb-4 h-0.5 w-6 rounded-full bg-primary/60" />
            <div className="space-y-2 text-xs leading-6 text-muted-foreground">
              <p>
                {t("Source:")} {t(item.source.replaceAll("_", " "))} · {item.record_count}{" "}
                {t("record(s)")}
              </p>
              {(item.period_start || item.period_end) && (
                <>
                  <p>
                    {t("Period covered:")} {item.period_start || t("Unknown start")} –{" "}
                    {item.period_end || t("Unknown end")} · {item.coverage_months}{" "}
                    {t("months with records")}
                  </p>
                  {item.months_without_records.length > 0 && (
                    <p>
                      {t("Months without records:")} {item.months_without_records.join(", ")}
                    </p>
                  )}
                </>
              )}
              {item.note &&
                item.note !== "Imported record presence does not verify a lender document." && (
                  <p>{t(item.note)}</p>
                )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
