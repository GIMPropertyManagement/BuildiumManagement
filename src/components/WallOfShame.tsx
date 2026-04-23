import { ExternalLink, Skull } from 'lucide-react';
import type { DashboardData } from '../buildium/metrics';
import {
  buildiumTaskUrl,
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

function TaskLink({ task }: { task: BuildiumTask }) {
  return (
    <a
      className="task-link"
      href={buildiumTaskUrl(task.Id)}
      target="_blank"
      rel="noreferrer"
      title="Open in Buildium"
    >
      <div className="task-title">
        {task.Title}
        <ExternalLink
          size={11}
          strokeWidth={2}
          className="task-link-icon"
          aria-hidden
        />
      </div>
      <div className="task-sub">#{task.Id}</div>
    </a>
  );
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
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Skull size={16} strokeWidth={2.2} color="var(--danger)" />
        Wall of Shame
      </h3>
      <p className="card-sub">
        Most neglected open tasks — click any row to open in Buildium.
      </p>

      <h4>Most stale (no updates)</h4>
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Assignee</th>
            <th>Category</th>
            <th>Status</th>
            <th className="num">Silent</th>
            <th className="num">Age</th>
            <th className="num">Overdue</th>
          </tr>
        </thead>
        <tbody>
          {topStale.map((t) => (
            <tr key={t.Id}>
              <td>
                <TaskLink task={t} />
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
                <th className="num">Overdue</th>
                <th className="num">Silent</th>
              </tr>
            </thead>
            <tbody>
              {topOverdue.map((t) => (
                <tr key={t.Id}>
                  <td>
                    <TaskLink task={t} />
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
