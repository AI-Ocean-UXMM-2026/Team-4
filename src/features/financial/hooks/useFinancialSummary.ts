import { useEffect, useRef, useState } from 'react';
import type { FinancialClient, FinancialSnapshot, Period, Trends } from '../types';

type State = { key: string; status: 'loading' | 'ready' | 'error'; snapshot?: FinancialSnapshot; trends?: Trends; error?: string };

export function useFinancialSummary(client: FinancialClient, businessId: string, period: Period, importBatchId: string | null, refreshKey: number, sourceVersion?: number) {
  const requestKey = JSON.stringify([businessId, period.start, period.end, importBatchId, refreshKey, sourceVersion]);
  const generation = useRef(0);
  const [state, setState] = useState<State>({ key: '', status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    setState({ key: requestKey, status: 'loading' });
    if (!importBatchId && !sourceVersion) {
      setState({ key: requestKey, status: 'error', error: 'No workbook imported. Connect your data source to begin.' });
      return () => controller.abort();
    }
    Promise.all([client.summary(businessId, period, controller.signal), client.trends(businessId, period.end, controller.signal)])
      .then(([snapshot, trends]) => {
        if (controller.signal.aborted || generation.current !== current) return;
        if (snapshot.business_id !== businessId || trends.business_id !== businessId || (importBatchId !== null && snapshot.import_batch_id !== importBatchId) || trends.import_batch_id !== snapshot.import_batch_id || (sourceVersion !== undefined && (snapshot.source_version !== sourceVersion || trends.source_version !== sourceVersion)) || snapshot.period.start !== period.start || snapshot.period.end !== period.end) {
          throw new Error('Financial data is stale or inconsistent. Refresh after the import finishes.');
        }
        setState({ key: requestKey, status: 'ready', snapshot, trends });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && generation.current === current) setState({ key: requestKey, status: 'error', error: error instanceof Error ? error.message : 'Financial API unavailable.' });
      });
    return () => controller.abort();
  }, [client, businessId, period.start, period.end, importBatchId, refreshKey, sourceVersion, requestKey]);
  // Hide old business/import values immediately, before effects run.
  return state.key === requestKey ? state : { key: requestKey, status: 'loading' as const };
}
