import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import type {
  BuildiumTask,
  BuildiumUser,
  TaskCategory,
  BuildiumTaskHistoryEntry,
} from './types';

/**
 * Two transports:
 *  - dev: hits /api/buildium/* which Vite proxies to Buildium with credential
 *    headers injected from .env (see vite.config.ts). Stays entirely local.
 *  - prod: round-trips the AppSync `buildiumFetch` query → Lambda → Buildium.
 *
 * Callers only see fetchTasks / fetchUsers / ... — the transport choice is an
 * implementation detail.
 */

const IS_DEV = import.meta.env.DEV;
const MAX_PAGE = 1000;
const MAX_ITEMS = 10_000;

export interface BuildiumFetchResult<T> {
  items: T[];
  totalCount: number;
}

type QueryValue = string | number | boolean | Array<string | number | boolean>;
type QueryObject = Record<string, QueryValue | null | undefined>;

function buildQueryString(query: QueryObject): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) qs.append(key, String(item));
    } else {
      qs.append(key, String(value));
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
    throw new Error(
      `Buildium ${res.status} at ${path}: ${text.slice(0, 200)}`,
    );
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
): Promise<BuildiumFetchResult<T>> {
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
): Promise<BuildiumFetchResult<T>> {
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

function rawFetch<T>(
  path: string,
  query: QueryObject = {},
  fetchAll = true,
): Promise<BuildiumFetchResult<T>> {
  return IS_DEV
    ? devFetch<T>(path, query, fetchAll)
    : prodFetch<T>(path, query, fetchAll);
}

export function fetchTasks(query: QueryObject = {}) {
  return rawFetch<BuildiumTask>('/v1/tasks', { limit: 1000, ...query }, true);
}

export function fetchUsers(query: QueryObject = {}) {
  return rawFetch<BuildiumUser>('/v1/users', { limit: 1000, ...query }, true);
}

export function fetchTaskCategories() {
  return rawFetch<TaskCategory>('/v1/tasks/categories', { limit: 1000 }, true);
}

export function fetchTaskHistory(taskId: number) {
  return rawFetch<BuildiumTaskHistoryEntry>(
    `/v1/tasks/${taskId}/history`,
    { limit: 200 },
    true,
  );
}
