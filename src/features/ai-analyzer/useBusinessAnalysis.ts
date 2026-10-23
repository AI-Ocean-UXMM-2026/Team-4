import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlatform } from "@/app/providers";
import { api } from "@/lib/apiClient";
import type { AIAnalysis } from "./types";

export function useBusinessAnalysis() {
  const { business } = usePlatform();
  const queries = useQueryClient();
  const path = `?business_id=${encodeURIComponent(business.id)}`;
  const key = ["ai-analysis", business.id, business.source_version] as const;
  const latest = useQuery({
    queryKey: key,
    queryFn: () => api<AIAnalysis | null>(`/api/v1/ai/insights/latest${path}`),
  });
  const analyze = useMutation({
    mutationFn: (providerConsent: boolean) =>
      api<AIAnalysis>(`/api/v1/ai/analyze${path}`, {
        method: "POST",
        body: JSON.stringify({
          source_version: business.source_version,
          provider_consent: providerConsent,
        }),
      }),
    onSuccess: (result) => queries.setQueryData(key, result),
  });
  const candidates = [analyze.data, latest.data];
  const report =
    candidates.find(
      (item) =>
        item?.business_id === business.id &&
        item.source_version === business.source_version &&
        !item.outdated,
    ) ?? null;
  return {
    business,
    report,
    isOutdated:
      !report &&
      candidates.some(
        (item) =>
          item?.business_id === business.id &&
          (item.outdated || item.source_version !== business.source_version),
      ),
    isLoading: latest.isPending,
    error: analyze.error ?? latest.error,
    isAnalyzing: analyze.isPending,
    run: (providerConsent: boolean) => analyze.mutate(providerConsent),
    refresh: () => queries.invalidateQueries({ queryKey: key }),
  };
}
