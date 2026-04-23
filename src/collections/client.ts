import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type {
  AssociationOwner,
  AssociationUnit,
  BalanceBucket,
  OutstandingBalance,
  OwnershipAccount,
} from './types';

/**
 * Collections fetchers. Dual-transport like the other clients:
 *   - dev  → /api/buildium/* through the Vite proxy
 *   - prod → buildiumFetch AppSync → Lambda
 */

const IS_DEV = import.meta.env.DEV;
const MAX_PAGE = 1000;
const MAX_ITEMS = 50_000;

type QueryValue = string | number | boolean | Array<string | number | boolean>;
type QueryObject = Record<string, QueryValue | null | undefined>;

export interface FetchResult<T> {
  items: T[];
  totalCount: number;
}

function buildQueryString(query: QueryObject): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) qs.append(k, String(item));
    } else {
      qs.append(k, String(v));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

async function devSinglePage<T>(
  path: string,
  query: QueryObject,
): Promise<{ items: T[]; totalCount: number }> {
  const res = await fetch(`/api/buildium${path}${buildQueryString(query)}`);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Buildium ${res.status} at ${path}: ${text.slice(0, 200)}`);
  }
  const body = text ? JSON.parse(text) : null;
  const totalCount = Number(res.headers.get('x-total-count') || 0);
  const items = Array.isArray(body)
    ? (body as T[])
    : body
      ? [body as T]
      : [];
  return { items, totalCount };
}

async function devFetch<T>(
  path: string,
  query: QueryObject,
  fetchAll: boolean,
): Promise<FetchResult<T>> {
  if (!fetchAll) return devSinglePage<T>(path, query);
  const pageSize = Math.min(Number(query.limit ?? MAX_PAGE) || MAX_PAGE, MAX_PAGE);
  const collected: T[] = [];
  let offset = 0;
  let totalCount = 0;
  while (collected.length < MAX_ITEMS) {
    const { items, totalCount: t } = await devSinglePage<T>(path, {
      ...query,
      limit: pageSize,
      offset,
    });
    totalCount = t;
    collected.push(...items);
    offset += items.length;
    if (items.length < pageSize || offset >= totalCount || items.length === 0) break;
  }
  return { items: collected, totalCount };
}

const amplifyClient = generateClient<Schema>();

async function prodFetch<T>(
  path: string,
  query: QueryObject,
  fetchAll: boolean,
): Promise<FetchResult<T>> {
  const { data, errors } = await amplifyClient.queries.buildiumFetch({
    path,
    queryJson: Object.keys(query).length ? JSON.stringify(query) : null,
    fetchAll,
  });
  if (errors && errors.length) {
    throw new Error(errors.map((e) => e.message).join('; '));
  }
  if (!data) throw new Error('Empty response from Buildium proxy');
  const parsed = JSON.parse(String(data)) as {
    items: T[] | T;
    totalCount: number;
  };
  const items = Array.isArray(parsed.items)
    ? parsed.items
    : parsed.items
      ? [parsed.items as T]
      : [];
  return { items, totalCount: parsed.totalCount ?? items.length };
}

function collectionsFetch<T>(
  path: string,
  query: QueryObject = {},
  fetchAll = true,
): Promise<FetchResult<T>> {
  return IS_DEV
    ? devFetch<T>(path, query, fetchAll)
    : prodFetch<T>(path, query, fetchAll);
}

export function fetchActiveOwners() {
  return collectionsFetch<AssociationOwner>(
    '/v1/associations/owners',
    { statuses: 'Active', limit: 1000 },
    true,
  );
}

export function fetchOwnershipAccounts() {
  return collectionsFetch<OwnershipAccount>(
    '/v1/associations/ownershipaccounts',
    { limit: 1000 },
    true,
  );
}

export function fetchOutstandingBalances(
  associationId: number,
  bucket: BalanceBucket,
) {
  return collectionsFetch<OutstandingBalance>(
    '/v1/associations/ownershipaccounts/outstandingbalances',
    {
      associationid: associationId,
      ownershipaccountstatuses: 'Active',
      balanceduration: bucket,
      limit: 1000,
    },
    true,
  );
}

export function fetchAssociationUnit(unitId: number) {
  return collectionsFetch<AssociationUnit>(
    `/v1/associations/units/${unitId}`,
    {},
    false,
  );
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
      done += 1;
      onProgress?.(done, items.length);
    }
  });
  await Promise.all(workers);
  return results;
}
