import type { DashboardData } from '../buildium/metrics';
import {
  categoryLabel,
  daysOverdue,
  daysSinceUpdate,
  stalenessScore,
  taskAgeDays,
} from '../buildium/metrics';
import type { BuildiumTask } from '../buildium/types';

interface Props {
  data: DashboardData;
}

function assigneeName(data: DashboardData, task: BuildiumTask): string {
  const bucket = data.byStaff.find((b) => b.id === (task.AssignedToUserId || 0));
  return bucket?.displayName ?? 'Unassigned';
}

export function WallOfShame({ data }: Props) {
  const topStale = [...data.rawActive]
    .sort((a, b) => stalenessScore(b) - stalenessScore(a))
    .slice(0, 10);

  const topOverdue = [...data.rawActive]
    .filter((t) => daysOverdue(t) > 0)
    .sort((a, b) => daysOverdue(b) - daysOverdue(a))
    .slice(0, 10);

  return (
    <div className="card wall-of-shame">
      <h3>☠️ Wall of Shame</h3>
      <p className="card-sub">
        Most neglected open tasks by silence + overdue penalty. Surface these in
        standup and they get handled.
      </p>

      <h4>Most stale (no updates)</h4>
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Assignee</th>
            <th>Category</th>
            <th>Status</th>
            <th>Days silent</th>
            <th>Age</th>
            <th>Overdue</th>
          </tr>
        </thead>
        <tbody>
          {topStale.map((t) => (
            <tr key={t.Id}>
              <td>
                <div className="task-title">{t.Title}</div>
                <div className="task-sub">#{t.Id}</div>
              </td>
              <td>{assigneeName(data, t)}</td>
              <td>{categoryLabel(t)}</td>
              <td>
                <span className={`pill status-${t.TaskStatus.toLowerCase()}`}>
                  {t.TaskStatus}
                </span>
              </td>
              <td className="num alert">{daysSinceUpdate(t)}d</td>
              <td className="num">{taskAgeDays(t)}d</td>
              <td className="num">
                {daysOverdue(t) ? (
                  <span className="alert">{daysOverdue(t)}d</span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {topOverdue.length ? (
        <>
          <h4>Most overdue</h4>
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Assignee</th>
                <th>Due</th>
                <th>Overdue</th>
                <th>Silent</th>
              </tr>
            </thead>
            <tbody>
              {topOverdue.map((t) => (
                <tr key={t.Id}>
                  <td>
                    <div className="task-title">{t.Title}</div>
                    <div className="task-sub">#{t.Id}</div>
                  </td>
                  <td>{assigneeName(data, t)}</td>
                  <td>{t.DueDate ?? '—'}</td>
                  <td className="num alert">{daysOverdue(t)}d</td>
                  <td className="num">{daysSinceUpdate(t)}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
