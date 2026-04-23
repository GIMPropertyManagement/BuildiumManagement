import { useMemo, useState } from 'react';
import { useDashboardData } from '../buildium/useDashboardData';
import { MetricCard } from './MetricCard';
import { Leaderboard } from './Leaderboard';
import { WallOfShame } from './WallOfShame';
import { StaffScorecard } from './StaffScorecard';
import { CategoryBar, PriorityPie, StatusPie, ThroughputLine } from './Charts';
import type { StaffMetrics } from '../buildium/metrics';

interface DashboardProps {
  onSignOut: () => void;
  userEmail?: string;
}

function timeAgo(d: Date) {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function Dashboard({ onSignOut, userEmail }: DashboardProps) {
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
      <header className="topbar">
        <div>
          <h1>Property Management Scoreboard</h1>
          <p className="subtitle">
            Live task metrics from Buildium · last refresh{' '}
            {data ? timeAgo(data.lastUpdated) : '—'}
          </p>
        </div>
        <div className="topbar-actions">
          <button onClick={refresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <div className="user-chip">
            <span>{userEmail ?? 'Signed in'}</span>
            <button className="link-btn" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="banner banner-error">
          <strong>Couldn't load Buildium data.</strong> {error}
          <div className="banner-hint">
            If this is first-run, set the Amplify secrets{' '}
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
          <section className="metric-row">
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
              tone={data.team.totalStale > 20 ? 'bad' : data.team.totalStale > 5 ? 'warn' : 'good'}
            />
            <MetricCard
              label="High priority open"
              value={data.team.totalHighPriorityOpen}
              tone={data.team.totalHighPriorityOpen > 0 ? 'warn' : 'good'}
            />
            <MetricCard
              label="Closed last 7d"
              value={data.team.closedLast7}
              hint={`${data.team.createdLast7} created in same window`}
              tone={
                data.team.closedLast7 >= data.team.createdLast7 ? 'good' : 'warn'
              }
            />
            <MetricCard
              label="Closed last 30d"
              value={data.team.closedLast30}
              hint={`${data.team.createdLast30} created`}
            />
            <MetricCard
              label="Avg days to close"
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
              label="Oldest open task"
              value={`${data.team.oldestOpenDays}d`}
              tone={data.team.oldestOpenDays > 60 ? 'bad' : 'warn'}
            />
          </section>

          <section className="two-col">
            <Leaderboard rows={data.byStaff} />
            <div className="card team-insight">
              <h3>How the score works</h3>
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
                  <strong>−0.3 per day</strong> on oldest open task age
                </li>
              </ul>
              <p className="note">
                Scores refresh every 5 minutes. Deferring tasks doesn't count as
                closing them.
              </p>
            </div>
          </section>

          <section className="chart-row">
            <ThroughputLine team={data.team} />
          </section>

          <section className="chart-row three-col">
            <StatusPie team={data.team} />
            <PriorityPie team={data.team} />
            <CategoryBar team={data.team} />
          </section>

          <section className="scorecards-section">
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
            <div className="scorecards-grid">
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
            Totals: {data.rawActive.length} active + {data.rawRecentClosed.length}{' '}
            recently closed tasks analysed. Buildium API rate-limited to 10
            concurrent req/sec.
          </footer>
        </>
      ) : null}
    </div>
  );
}
