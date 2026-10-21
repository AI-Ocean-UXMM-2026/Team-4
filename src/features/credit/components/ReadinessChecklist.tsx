import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReadinessCategory } from "../types";

export function ReadinessChecklist({ items }: { items: ReadinessCategory[] }) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <Card key={item.category}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{t(item.title)}</CardTitle>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">
                {t(item.status.replaceAll("_", " "))}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
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
            {item.note && <p>{t(item.note)}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
