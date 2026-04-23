import type { Schema } from '../../data/resource';

type QueryValue = string | number | boolean | Array<string | number | boolean>;
type QueryObject = Record<string, QueryValue | null | undefined>;

const MAX_PAGE = 1000;
const MAX_ITEMS = 10_000;

const ALLOWED_PATH_PATTERNS: RegExp[] = [
  /^\/v1\/tasks$/,
  /^\/v1\/tasks\/\d+$/,
  /^\/v1\/tasks\/\d+\/history$/,
  /^\/v1\/tasks\/categories$/,
  /^\/v1\/users$/,
  /^\/v1\/users\/\d+$/,
  /^\/v1\/userroles$/,
  /^\/v1\/rentals$/,
  /^\/v1\/rentals\/\d+$/,
  /^\/v1\/associations$/,
  /^\/v1\/associations\/\d+$/,
  /^\/v1\/workorders$/,
  /^\/v1\/workorders\/\d+$/,
  // Finance endpoints (read-only, credentials scoped view-only)
  /^\/v1\/bankaccounts$/,
  /^\/v1\/bankaccounts\/\d+$/,
  /^\/v1\/bankaccounts\/\d+\/transactions$/,
  /^\/v1\/bankaccounts\/\d+\/reconciliations$/,
  /^\/v1\/glaccounts$/,
  /^\/v1\/glaccounts\/\d+$/,
  /^\/v1\/glaccounts\/balances$/,
];

function isAllowed(path: string): boolean {
  return ALLOWED_PATH_PATTERNS.some((re) => re.test(path));
}

function buildQueryString(query: QueryObject): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
      }
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

async function buildiumGet(path: string, query: QueryObject): Promise<{
  items: unknown;
  totalCount: number;
  status: number;
}> {
  const baseUrl = process.env.BUILDIUM_BASE_URL || 'https://api.buildium.com';
  const clientId = process.env.BUILDIUM_CLIENT_ID;
  const clientSecret = process.env.BUILDIUM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    // Report presence + length (never the value) so a 401 vs. missing-env
    // failure is diagnosable from the frontend error banner.
    throw new Error(
      `Buildium credentials missing at runtime — ` +
        `client_id present=${!!clientId} (${(clientId ?? '').length} chars), ` +
        `client_secret present=${!!clientSecret} (${(clientSecret ?? '').length} chars). ` +
        `Fix in Amplify Console → App settings → Environment variables (branch scope), ` +
        `then redeploy. See README "Deploying to Amplify Hosting".`,
    );
  }

  const url = `${baseUrl}${path}${buildQueryString(query)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-buildium-client-id': clientId,
      'x-buildium-client-secret': clientSecret,
      Accept: 'application/json',
    },
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!res.ok) {
    throw new Error(`Buildium ${res.status}: ${typeof body === 'object' ? JSON.stringify(body) : String(body)}`);
  }

  const totalHeader = res.headers.get('x-total-count');
  const totalCount = totalHeader ? Number(totalHeader) : 0;

  return { items: body, totalCount, status: res.status };
}

async function fetchAllPages(path: string, baseQuery: QueryObject): Promise<{
  items: unknown[];
  totalCount: number;
}> {
  const pageSize = Math.min(
    Number(baseQuery.limit ?? MAX_PAGE) || MAX_PAGE,
    MAX_PAGE,
  );
  const collected: unknown[] = [];
  let offset = 0;
  let totalCount = 0;

  while (collected.length < MAX_ITEMS) {
    const q: QueryObject = { ...baseQuery, limit: pageSize, offset };
    const { items, totalCount: t } = await buildiumGet(path, q);
    totalCount = t;
    const page = Array.isArray(items) ? (items as unknown[]) : [];
    collected.push(...page);
    offset += page.length;
    if (page.length < pageSize || offset >= totalCount || page.length === 0) break;
  }

  return { items: collected, totalCount };
}

export const handler: Schema['buildiumFetch']['functionHandler'] = async (event) => {
  const args = event.arguments ?? {};
  const path = args.path;
  const queryJson = args.queryJson ?? null;
  const fetchAll = args.fetchAll ?? false;

  if (!path || typeof path !== 'string') {
    throw new Error('path is required');
  }
  if (!isAllowed(path)) {
    throw new Error(`Path not allowed: ${path}`);
  }

  let query: QueryObject = {};
  if (queryJson) {
    try {
      const parsed = JSON.parse(queryJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        query = parsed as QueryObject;
      }
    } catch {
      throw new Error('queryJson must be valid JSON object');
    }
  }

  if (fetchAll) {
    const { items, totalCount } = await fetchAllPages(path, query);
    return JSON.stringify({ items, totalCount });
  }

  const { items, totalCount } = await buildiumGet(path, query);
  return JSON.stringify({ items, totalCount });
};
