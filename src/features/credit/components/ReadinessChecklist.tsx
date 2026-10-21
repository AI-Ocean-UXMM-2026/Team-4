import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReadinessCategory } from "../types";

export function ReadinessChecklist({ items }: { items: ReadinessCategory[] }) {
  return <div className="grid gap-3 md:grid-cols-2">{items.map((item) => <Card key={item.category}><CardHeader className="pb-2"><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">{item.title}</CardTitle><span className="rounded-full bg-secondary px-2.5 py-1 text-xs">{item.status.replaceAll("_", " ")}</span></div></CardHeader><CardContent className="space-y-1 text-sm text-muted-foreground"><p>Source: {item.source.replaceAll("_", " ")} · {item.record_count} record(s)</p>{(item.period_start || item.period_end) && <><p>Period covered: {item.period_start || "Unknown start"} – {item.period_end || "Unknown end"} · {item.coverage_months} months with records</p>{item.months_without_records.length > 0 && <p>Months without records: {item.months_without_records.join(", ")}</p>}</>}{item.note && <p>{item.note}</p>}</CardContent></Card>)}</div>;
}
