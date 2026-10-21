import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreditSummary } from "../types";

export function RepaymentCapacity({ data }: { data: CreditSummary["repayment_capacity"] }) {
  const { t } = useTranslation();

  const title =
    data.status === "insufficient_data"
      ? "Cash planning data unavailable"
      : data.status === "potential_shortfall"
        ? "Potential cash shortfall"
        : "Appears covered from recorded cash";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{data.explanation}</p>
        {data.repayment_gap_mmk !== null && (
          <p className="mt-3 font-semibold">
            {t("Planning gap:")} {Number(data.repayment_gap_mmk).toLocaleString("en-US")} {t("MMK")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
