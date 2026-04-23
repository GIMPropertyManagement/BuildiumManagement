import { useMemo, useState } from 'react';
import { useDashboardData } from '../buildium/useDashboardData';
import { MetricCard } from './MetricCard';
import { TopBar } from './TopBar';
import { Leaderboard } from './Leaderboard';
import { WallOfShame } from './WallOfShame';
import { StaffScorecard } from './StaffScorecard';
import { CategoryBar, PriorityPie, StatusPie, ThroughputLine } from './Charts';
import type { StaffMetrics } from '../buildium/metrics';

import type { DashboardPage } from './TopBar';

interface DashboardProps {
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

export function Dashboard({ onSignOut, userEmail, onNavigate }: DashboardProps) {
  const { data, loading, error, refresh } = useDashboardData();
  const [filter, setFilter] = useState<'all' | 'staff' | 'unassigned'>('staff');

  const filtered: StaffMetrics[] = useMemo(() => {
    if (!data) return [];
    if (filter === 'unassigned') return data.byStaff.filter((b) => b.id === 0);
    if (filter === 'staff')
      return data.byStaff.filter((b) => b.id !== 0 && b.isActiveStaff);
    return data.byStaff;
  }, [data, filter]);

  return (
    <div className="dashboard">
      <TopBar
        page="tasks"
        onNavigate={onNavigate}
        onRefresh={refresh}
        refreshing={loading}
        onSignOut={onSignOut}
        userEmail={userEmail}
      />

      <div className="page-head">
        <h1>Property management scoreboard</h1>
        <p className="subtitle">
          Live Buildium task metrics · last refresh{' '}
          {data ? timeAgo(data.lastUpdated) : '—'}
        </p>
      </div>

      {error ? (
        <div className="banner banner-error">
          <strong>Couldn't load Buildium data.</strong> {error}
          <div className="banner-hint">
            If this is first-run, set the Amplify env vars{' '}
            <code>BUILDIUM_CLIENT_ID</code> and{' '}
            <code>BUILDIUM_CLIENT_SECRET</code>, then refresh.
          </div>
        </div>
      ) : null}

      {!data && loading ? (
        <div className="loading-state">Loading dashboard…</div>
      ) : null}

      {data ? (
        <>
          <section className="grid-row grid-kpi">
            <MetricCard
              label="Open tasks"
              value={data.team.totalOpen}
              hint={`${data.team.totalUnassigned} unassigned`}
              tone={data.team.totalOpen > 250 ? 'warn' : 'neutral'}
            />
            <MetricCard
              label="Overdue"
              value={data.team.totalOverdue}
              hint="Due date passed"
              tone={data.team.totalOverdue > 0 ? 'bad' : 'good'}
            />
            <MetricCard
              label="Stale 7d+"
              value={data.team.totalStale}
              hint="No update in a week"
              tone={
                data.team.totalStale > 20
                  ? 'bad'
                  : data.team.totalStale > 5
                    ? 'warn'
                    : 'good'
              }
            />
            <MetricCard
              label="High priority"
              value={data.team.totalHighPriorityOpen}
              hint="Still open"
              tone={data.team.totalHighPriorityOpen > 0 ? 'warn' : 'good'}
            />
            <MetricCard
              label="Closed · 7d"
              value={data.team.closedLast7}
              hint={`${data.team.createdLast7} created in same window`}
              tone={
                data.team.closedLast7 >= data.team.createdLast7 ? 'good' : 'warn'
              }
            />
            <MetricCard
              label="Closed · 30d"
              value={data.team.closedLast30}
              hint={`${data.team.createdLast30} created`}
            />
            <MetricCard
              label="Avg close (d)"
              value={
                data.team.avgDaysToClose != null
                  ? data.team.avgDaysToClose.toFixed(1)
                  : '—'
              }
              hint={
                data.team.medianDaysToClose != null
                  ? `median ${data.team.medianDaysToClose.toFixed(1)}d`
                  : undefined
              }
            />
            <MetricCard
              label="Oldest open"
              value={`${data.team.oldestOpenDays}d`}
              hint="Task age"
              tone={data.team.oldestOpenDays > 60 ? 'bad' : 'warn'}
            />
          </section>

          <section className="grid-row grid-2col">
            <Leaderboard rows={data.byStaff} />
            <div className="card team-insight">
              <h3>How the score works</h3>
              <p className="card-sub">
                Higher is better. Deferrals don't count as closures.
              </p>
              <ul>
                <li>
                  <strong>+10</strong> per task closed in last 30 days
                </li>
                <li>
                  <strong>+5</strong> per task closed in last 7 days
                </li>
                <li>
                  <strong>−15</strong> per overdue open task
                </li>
                <li>
                  <strong>−5</strong> per stale (no update 7d+) open task
                </li>
                <li>
                  <strong>−3</strong> per open high-priority task
                </li>
                <li>
                  <strong>−0.3/d</strong> on oldest open task age
                </li>
              </ul>
              <p className="note">Scores refresh every 5 minutes.</p>
            </div>
          </section>

          <section className="grid-row">
            <ThroughputLine team={data.team} />
          </section>

          <section className="grid-row grid-3col">
            <StatusPie team={data.team} />
            <PriorityPie team={data.team} />
            <CategoryBar team={data.team} />
          </section>

          <section>
            <div className="section-head">
              <h2>Per-manager scorecards</h2>
              <div className="filter-tabs">
                <button
                  className={filter === 'staff' ? 'active' : ''}
                  onClick={() => setFilter('staff')}
                >
                  Active staff
                </button>
                <button
                  className={filter === 'unassigned' ? 'active' : ''}
                  onClick={() => setFilter('unassigned')}
                >
                  Unassigned
                </button>
                <button
                  className={filter === 'all' ? 'active' : ''}
                  onClick={() => setFilter('all')}
                >
                  All
                </button>
              </div>
            </div>
            <div className="grid-row grid-scorecards">
              {filtered.map((staff, i) => (
                <StaffScorecard key={staff.id} staff={staff} rank={i + 1} />
              ))}
              {!filtered.length ? (
                <div className="empty">No managers match the filter.</div>
              ) : null}
            </div>
          </section>

          <section>
            <WallOfShame data={data} />
          </section>

          <footer className="footer">
            {data.rawActive.length} active + {data.rawRecentClosed.length}{' '}
            recently closed tasks analysed · Buildium rate limit 10 req/s
          </footer>
        </>
      ) : null}
    </div>
  );
}
