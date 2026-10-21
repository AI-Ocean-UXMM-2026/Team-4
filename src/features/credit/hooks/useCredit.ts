import { useQuery } from "@tanstack/react-query";
import { usePlatform } from "@/app/providers";
import { api } from "@/lib/apiClient";
import type { CreditSummary } from "../types";

export function useCredit() {
  const { business } = usePlatform();
  return useQuery({
    queryKey: ["credit-summary", business.id],
    queryFn: () =>
      api<CreditSummary>(`/api/v1/credit/summary?business_id=${encodeURIComponent(business.id)}`),
  });
}
