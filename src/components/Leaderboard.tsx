import type { StaffMetrics } from '../buildium/metrics';

interface Props {
  rows: StaffMetrics[];
}

export function Leaderboard({ rows }: Props) {
  const ranked = rows
    .filter((r) => r.id !== 0 && r.isActiveStaff)
    .slice(0, 8);

  return (
    <div className="card leaderboard">
      <h3>🏆 Leaderboard — last 30 days</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Manager</th>
            <th>Score</th>
            <th>Closed 30d</th>
            <th>Closed 7d</th>
            <th>Avg days to close</th>
            <th>Open</th>
            <th>Overdue</th>
            <th>Stale 7d+</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r, i) => (
            <tr key={r.id} className={i === 0 ? 'row-leader' : ''}>
              <td>{i + 1}</td>
              <td>
                <div className="staff-cell">
                  <div className="staff-name">{r.displayName}</div>
                  <div className="staff-role">{r.role}</div>
                </div>
              </td>
              <td className="num">{r.score}</td>
              <td className="num">{r.closedLast30.length}</td>
              <td className="num">{r.closedLast7.length}</td>
              <td className="num">
                {r.avgDaysToClose != null ? r.avgDaysToClose.toFixed(1) : '—'}
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
