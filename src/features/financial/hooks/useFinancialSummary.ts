import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import type { FinancialClient, FinancialSnapshot, Period, Trends } from "../types";

type State = {
  key: string;
  status: "loading" | "ready" | "error";
  snapshot?: FinancialSnapshot;
  trends?: Trends;
  error?: string;
};

export function useFinancialSummary(
  client: FinancialClient,
  businessId: string,
  period: Period,
  importBatchId: string | null,
  refreshKey: number,
  sourceVersion?: number,
) {
  const requestKey = JSON.stringify([
    businessId,
    period.start,
    period.end,
    importBatchId,
    refreshKey,
    sourceVersion,
  ]);
  const cache = useContext(QueryClientContext);
  const cacheKey = useMemo(
    () => ["financial-summary", businessId, period.start, period.end, importBatchId, sourceVersion],
    [businessId, period.start, period.end, importBatchId, sourceVersion],
  );
  const cached = cache?.getQueryData<State>(cacheKey);
  const generation = useRef(0);
  const [state, setState] = useState<State>(() =>
    cached ? { ...cached, key: requestKey } : { key: "", status: "loading" },
  );
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    const saved = cache?.getQueryData<State>(cacheKey);
    const updated = cache?.getQueryState(cacheKey)?.dataUpdatedAt ?? 0;
    if (
      refreshKey === 0 &&
      saved &&
      !cache?.getQueryState(cacheKey)?.isInvalidated &&
      (sourceVersion !== undefined || Date.now() - updated < 60_000)
    ) {
      setState({ ...saved, key: requestKey });
      return () => controller.abort();
    }
    setState({ key: requestKey, status: "loading" });
    if (!importBatchId && !sourceVersion) {
      setState({
        key: requestKey,
        status: "error",
        error: "No workbook imported. Connect your data source to begin.",
      });
      return () => controller.abort();
    }
    Promise.all([
      client.summary(businessId, period, controller.signal),
      client.trends(businessId, period.end, controller.signal),
    ])
      .then(([snapshot, trends]) => {
        if (controller.signal.aborted || generation.current !== current) return;
        if (
          snapshot.business_id !== businessId ||
          trends.business_id !== businessId ||
          (importBatchId !== null && snapshot.import_batch_id !== importBatchId) ||
          trends.import_batch_id !== snapshot.import_batch_id ||
          (sourceVersion !== undefined &&
            (snapshot.source_version !== sourceVersion ||
              trends.source_version !== sourceVersion)) ||
          snapshot.period.start !== period.start ||
          snapshot.period.end !== period.end
        ) {
          throw new Error(
            "Financial data is stale or inconsistent. Refresh after the import finishes.",
          );
        }
        const next: State = { key: requestKey, status: "ready", snapshot, trends };
        cache?.setQueryData(cacheKey, next);
        setState(next);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && generation.current === current)
          setState({
            key: requestKey,
            status: "error",
            error: error instanceof Error ? error.message : "Financial API unavailable.",
          });
      });
    return () => controller.abort();
  }, [
    client,
    businessId,
    period.start,
    period.end,
    importBatchId,
    refreshKey,
    sourceVersion,
    requestKey,
    cache,
    cacheKey,
  ]);
  // Hide old business/import values immediately, before effects run.
  return state.key === requestKey ? state : { key: requestKey, status: "loading" as const };
}
