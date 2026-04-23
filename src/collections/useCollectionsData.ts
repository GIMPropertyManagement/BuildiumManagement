import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAssociations } from '../finance/client';
import {
  fetchActiveOwners,
  fetchAssociationUnit,
  fetchOutstandingBalances,
  fetchOwnershipAccounts,
  mapWithConcurrency,
} from './client';
import {
  buildCollectionsGroups,
  buildDelinquencyMap,
  buildOwnerMaps,
  summarizeCollections,
  type CollectionsGroup,
  type CollectionsSummary,
} from './analyzer';
import type {
  AssociationUnit,
  BalanceBucket,
  OutstandingBalance,
} from './types';

const BALANCE_CONCURRENCY = 4;
const UNIT_CONCURRENCY = 4;

export interface CollectionsReport {
  groups: CollectionsGroup[];
  summary: CollectionsSummary;
  bucket: BalanceBucket;
  generatedAt: Date;
}

interface LoadableState {
  data: CollectionsReport | null;
  loading: boolean;
  error: string | null;
  progress: { label: string; done: number; total: number } | null;
}

interface CollectionsHook {
  state: LoadableState;
  bucket: BalanceBucket;
  setBucket: (b: BalanceBucket) => void;
  refresh: () => void;
}

export function useCollectionsData(): CollectionsHook {
  const [bucket, setBucketState] = useState<BalanceBucket>('Balance61to90Days');
  const [state, setState] = useState<LoadableState>({
    data: null,
    loading: false,
    error: null,
    progress: null,
  });
  const inFlight = useRef(false);

  const load = useCallback(
    async (targetBucket: BalanceBucket) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setState((s) => ({ ...s, loading: true, error: null, progress: null }));

      try {
        setState((s) => ({
          ...s,
          progress: { label: 'Loading associations, owners, accounts…', done: 0, total: 3 },
        }));
        const [assocRes, ownersRes, accountsRes] = await Promise.all([
          fetchAssociations(),
          fetchActiveOwners(),
          fetchOwnershipAccounts(),
        ]);
        setState((s) => ({
          ...s,
          progress: { label: 'Loaded associations, owners, accounts', done: 3, total: 3 },
        }));

        const activeAssociations = assocRes.items.filter((a) => a.IsActive);
        const associationNameById = new Map<number, string>(
          activeAssociations.map((a) => [a.Id, a.Name]),
        );

        const { byOwnershipAccountId, byUnitId } = buildOwnerMaps(ownersRes.items);
        const delinquencyByOwnershipAccountId = buildDelinquencyMap(accountsRes.items);

        // Fan out per-association balance fetch
        setState((s) => ({
          ...s,
          progress: {
            label: 'Fetching outstanding balances',
            done: 0,
            total: activeAssociations.length,
          },
        }));

        const balanceResults = await mapWithConcurrency(
          activeAssociations,
          BALANCE_CONCURRENCY,
          async (assoc) => {
            try {
              const { items } = await fetchOutstandingBalances(assoc.Id, targetBucket);
              // The balanceduration filter still returns some rows with 0 in the
              // chosen bucket on some tenants — belt-and-suspenders filter.
              const filtered = items.filter((b) => {
                switch (targetBucket) {
                  case 'Balance0to30Days':
                    return Number(b.Balance0To30Days ?? 0) > 0;
                  case 'Balance31to60Days':
                    return Number(b.Balance31To60Days ?? 0) > 0;
                  case 'Balance61to90Days':
                    return Number(b.Balance61To90Days ?? 0) > 0;
                  case 'BalanceOver90Days':
                    return Number(b.BalanceOver90Days ?? 0) > 0;
                }
              });
              return { associationId: assoc.Id, balances: filtered };
            } catch {
              return { associationId: assoc.Id, balances: [] as OutstandingBalance[] };
            }
          },
          (done, total) =>
            setState((s) => ({
              ...s,
              progress: { label: 'Fetching outstanding balances', done, total },
            })),
        );

        const balancesByAssociation = new Map<number, OutstandingBalance[]>();
        const unitIdsNeeded = new Set<number>();
        for (const r of balanceResults) {
          if (r.balances.length === 0) continue;
          balancesByAssociation.set(r.associationId, r.balances);
          for (const b of r.balances) unitIdsNeeded.add(b.UnitId);
        }

        // Hydrate unit addresses
        const unitIds = Array.from(unitIdsNeeded);
        setState((s) => ({
          ...s,
          progress: { label: 'Resolving unit addresses', done: 0, total: unitIds.length },
        }));

        const unitFetches = await mapWithConcurrency(
          unitIds,
          UNIT_CONCURRENCY,
          async (id): Promise<AssociationUnit | null> => {
            try {
              const { items } = await fetchAssociationUnit(id);
              return items[0] ?? null;
            } catch {
              return null;
            }
          },
          (done, total) =>
            setState((s) => ({
              ...s,
              progress: { label: 'Resolving unit addresses', done, total },
            })),
        );

        const unitById = new Map<number, AssociationUnit>();
        unitFetches.forEach((u) => {
          if (u) unitById.set(u.Id, u);
        });

        const { groups, excludedInCollections } = buildCollectionsGroups({
          associationNameById,
          balancesByAssociation,
          ownerByOwnershipAccountId: byOwnershipAccountId,
          ownerByUnitId: byUnitId,
          delinquencyByOwnershipAccountId,
          unitById,
          bucket: targetBucket,
        });

        const summary = summarizeCollections(groups, excludedInCollections);

        setState({
          data: {
            groups,
            summary,
            bucket: targetBucket,
            generatedAt: new Date(),
          },
          loading: false,
          error: null,
          progress: null,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setState({ data: null, loading: false, error: msg, progress: null });
      } finally {
        inFlight.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    load(bucket);
  }, [bucket, load]);

  const setBucket = useCallback((b: BalanceBucket) => {
    setBucketState(b);
  }, []);

  const refresh = useCallback(() => {
    load(bucket);
  }, [bucket, load]);

  return { state, bucket, setBucket, refresh };
}
