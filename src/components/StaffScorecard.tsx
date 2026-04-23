import type { StaffMetrics } from '../buildium/metrics';
import { buildiumTaskUrl } from '../buildium/metrics';

interface Props {
  staff: StaffMetrics;
  rank: number;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function StaffScorecard({ staff, rank }: Props) {
  const health =
    staff.overdue.length === 0 && staff.stale.length === 0
      ? 'tone-good'
      : staff.overdue.length > 5 || staff.stale.length > 10
        ? 'tone-bad'
        : 'tone-warn';

  return (
    <div className={`scorecard ${health}`}>
      <div className="scorecard-tone" />
      <div className="scorecard-head">
        <div className="avatar">{initials(staff.displayName)}</div>
        <div style={{ minWidth: 0 }}>
          <div className="scorecard-name">
            {staff.displayName}
            {rank <= 3 ? <span className="rank-badge">#{rank}</span> : null}
          </div>
          <div className="scorecard-role">{staff.role}</div>
        </div>
        <div className="scorecard-score">
          <div className="score-num">{staff.score}</div>
          <div className="score-label">score</div>
        </div>
      </div>

      <div className="scorecard-grid">
        <Stat label="Open" value={staff.open.length} />
        <Stat
          label="Overdue"
          value={staff.overdue.length}
          alert={staff.overdue.length > 0}
        />
        <Stat
          label="Stale 7d+"
          value={staff.stale.length}
          alert={staff.stale.length > 0}
        />
        <Stat
          label="Hi-pri"
          value={staff.highPriorityOpen.length}
          alert={staff.highPriorityOpen.length > 0}
        />
        <Stat label="Closed 30d" value={staff.closedLast30.length} />
        <Stat label="Closed 7d" value={staff.closedLast7.length} />
        <Stat
          label="Avg (d)"
          value={
            staff.avgDaysToClose != null ? staff.avgDaysToClose.toFixed(1) : '—'
          }
        />
        <Stat
          label="Oldest"
          value={`${staff.oldestOpenDays}d`}
          alert={staff.oldestOpenDays > 30}
        />
      </div>

      {staff.longestSilenceTask ? (
        <div className="scorecard-callout">
          Quietest task:{' '}
          <a
            className="callout-link"
            href={buildiumTaskUrl(staff.longestSilenceTask.Id)}
            target="_blank"
            rel="noreferrer"
            title="Open in Buildium"
          >
            <strong>{staff.longestSilenceTask.Title}</strong>
          </a>{' '}
          — {staff.longestSilenceDays}d since update
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <div className={`stat ${alert ? 'stat-alert' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
