import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useCollectionsData } from '../collections/useCollectionsData';
import { BUCKET_OPTIONS, bucketLabel } from '../collections/analyzer';
import type { BalanceBucket } from '../collections/types';
import { MetricCard } from './MetricCard';
import { TopBar, type DashboardPage } from './TopBar';
import { CollectionsGroupCard } from './collections/CollectionsGroupCard';

interface Props {
  onSignOut: () => void;
  userEmail?: string;
  onNavigate: (page: DashboardPage) => void;
}

function timeAgo(d: Date) {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function formatMoney(n: number, fractional = true): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractional ? 0 : 0,
    maximumFractionDigits: fractional ? 0 : 0,
  });
}

export function CollectionsPage({ onSignOut, userEmail, onNavigate }: Props) {
  const { state, bucket, setBucket, refresh } = useCollectionsData();
  const [filterText, setFilterText] = useState('');

  const filteredGroups = useMemo(() => {
    if (!state.data) return [];
    const needle = filterText.trim().toLowerCase();
    if (!needle) return state.data.groups;
    return state.data.groups
      .map((g) => {
        const matchAssoc = g.associationName.toLowerCase().includes(needle);
        if (matchAssoc) return g;
        const rows = g.rows.filter((r) =>
          [r.owner.name, r.owner.email, r.owner.phone, r.address]
            .some((s) => s.toLowerCase().includes(needle)),
        );
        return rows.length ? { ...g, rows } : null;
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
  }, [state.data, filterText]);

  const summary = state.data?.summary;
  const label = bucketLabel(bucket);

  return (
    <div className="dashboard">
      <TopBar
        page="collections"
        onNavigate={onNavigate}
        onRefresh={refresh}
        refreshing={state.loading}
        onSignOut={onSignOut}
        userEmail={userEmail}
      />

      <div className="page-head">
        <h1>Collections aging</h1>
        <p className="subtitle">
          Past-due HOA ownership accounts grouped by association. Accounts
          already marked <strong>InCollections</strong> are excluded.
          {state.data ? ` · Updated ${timeAgo(state.data.generatedAt)}` : ''}
        </p>
      </div>

      {state.error ? (
        <div className="banner banner-error">
          <strong>Couldn't load collections data.</strong> {state.error}
        </div>
      ) : null}

      <div className="collections-controls">
        <div className="bucket-switch">
          {BUCKET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={opt.value === bucket ? 'active' : ''}
              onClick={() => setBucket(opt.value as BalanceBucket)}
              disabled={state.loading}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="search-field">
          <Search size={14} strokeWidth={2} />
          <input
            placeholder="Filter by association, owner, address…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      </div>

      <section className="grid-row grid-kpi">
        <MetricCard
          label="Associations"
          value={summary?.associationCount ?? (state.loading ? '…' : '—')}
          hint="With past-due balances"
        />
        <MetricCard
          label="Owners past due"
          value={summary?.ownerCount ?? (state.loading ? '…' : '—')}
          hint={`In the ${label} bucket`}
          tone={summary && summary.ownerCount > 0 ? 'warn' : 'good'}
        />
        <MetricCard
          label={`${label} balance`}
          value={summary ? formatMoney(summary.bucketTotal, false) : '—'}
          hint="Bucket subtotal"
          tone={summary && summary.bucketTotal > 0 ? 'bad' : 'good'}
        />
        <MetricCard
          label="Total past-due"
          value={summary ? formatMoney(summary.totalBalance, false) : '—'}
          hint="All aging buckets"
          tone={summary && summary.totalBalance > 0 ? 'warn' : 'good'}
        />
        <MetricCard
          label="Excluded · InCollections"
          value={summary?.excludedInCollections ?? (state.loading ? '…' : '—')}
          hint="Hidden from this list"
        />
      </section>

      {state.loading && state.progress ? (
        <div className="progress">
          {state.progress.label} — {state.progress.done}/{state.progress.total}
        </div>
      ) : null}

      {!state.data && state.loading ? (
        <div className="loading-state">
          Loading collections aging report… this can take a minute.
        </div>
      ) : null}

      {state.data && filteredGroups.length === 0 && !state.loading ? (
        <div className="card">
          <div className="empty success">
            {filterText
              ? `No results match "${filterText}".`
              : `No ${label} past-due balances after excluding accounts in collections.`}
          </div>
        </div>
      ) : null}

      {filteredGroups.map((group) => (
        <CollectionsGroupCard
          key={group.associationId}
          group={group}
          bucket={bucket}
          initiallyOpen={filteredGroups.length <= 5}
        />
      ))}

      <footer className="footer">
        Collections pulled across {summary?.associationCount ?? 0} associations;
        active ownership accounts only; InCollections accounts excluded. Source:
        Buildium API at 4-way concurrency (under 10 req/s ceiling).
      </footer>
    </div>
  );
}
