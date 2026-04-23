import { Trophy } from 'lucide-react';
import type { StaffMetrics } from '../buildium/metrics';

interface Props {
  rows: StaffMetrics[];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function Leaderboard({ rows }: Props) {
  const ranked = rows.filter((r) => r.id !== 0 && r.isActiveStaff).slice(0, 8);

  return (
    <div className="card leaderboard">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Trophy size={16} strokeWidth={2.2} color="var(--warning)" />
        Leaderboard — last 30 days
      </h3>
      <p className="card-sub">
        Composite score from closures, staleness, and overdue penalties.
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: 32 }}>#</th>
            <th>Manager</th>
            <th className="num">Score</th>
            <th className="num">Closed 30d</th>
            <th className="num">Closed 7d</th>
            <th className="num">Avg close</th>
            <th className="num">Open</th>
            <th className="num">Overdue</th>
            <th className="num">Stale</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r, i) => (
            <tr key={r.id} className={i === 0 ? 'row-leader' : ''}>
              <td style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                {i + 1}
              </td>
              <td>
                <div className="staff-cell">
                  <div className="avatar-sm">{initials(r.displayName)}</div>
                  <div>
                    <div className="staff-name">{r.displayName}</div>
                    <div className="staff-role">{r.role}</div>
                  </div>
                </div>
              </td>
              <td className="num">{r.score}</td>
              <td className="num">{r.closedLast30.length}</td>
              <td className="num">{r.closedLast7.length}</td>
              <td className="num">
                {r.avgDaysToClose != null ? `${r.avgDaysToClose.toFixed(1)}d` : '—'}
              </td>
              <td className="num">{r.open.length}</td>
              <td className={`num ${r.overdue.length ? 'alert' : ''}`}>
                {r.overdue.length}
              </td>
              <td className={`num ${r.stale.length ? 'alert' : ''}`}>
                {r.stale.length}
              </td>
            </tr>
          ))}
          {!ranked.length ? (
            <tr>
              <td colSpan={9} className="empty">
                No assignee activity in the last 30 days.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
