import { useCallback, useEffect, useRef, useState } from 'react';
import { subDays } from 'date-fns';
import { fetchTasks, fetchUsers } from './client';
import { linkAssigneeUsers, computeMetrics, type DashboardData } from './metrics';
import { ACTIVE_STATUSES, COMPLETED_STATUSES } from './types';

const REFRESH_MS = 5 * 60 * 1000;

interface HookState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDashboardData(): HookState {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inflightRef = useRef(false);

  const load = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const lastUpdatedFrom = subDays(new Date(), 30).toISOString().slice(0, 10);

      const [activeRes, closedRes, staffRes] = await Promise.all([
        fetchTasks({ statuses: ACTIVE_STATUSES }),
        fetchTasks({
          statuses: COMPLETED_STATUSES,
          lastupdatedfrom: lastUpdatedFrom,
          orderby: 'LastUpdatedDateTime desc',
        }),
        fetchUsers({ usertypes: 'Staff' }),
      ]);

      const users = linkAssigneeUsers(
        [...activeRes.items, ...closedRes.items],
        staffRes.items,
      );
      const metrics = computeMetrics(activeRes.items, closedRes.items, users);
      setData(metrics);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const handle = setInterval(load, REFRESH_MS);
    return () => clearInterval(handle);
  }, [load]);

  return { data, loading, error, refresh: load };
}
