import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TeamMetrics } from '../buildium/metrics';

const STATUS_COLORS: Record<string, string> = {
  New: '#4f90ff',
  InProgress: '#f4a93d',
  Deferred: '#b45bff',
  Completed: '#42c98a',
  Closed: '#30a56f',
};

const PRIORITY_COLORS: Record<string, string> = {
  High: '#ff4d4d',
  Normal: '#6a85ff',
  Low: '#9aa7bd',
};

interface Props {
  team: TeamMetrics;
}

export function StatusPie({ team }: Props) {
  const data = Object.entries(team.statusBreakdown)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="card chart-card">
      <h3>Open + recently closed by status</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={90}
            label={(e) => `${e.name}: ${e.value}`}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={STATUS_COLORS[d.name] ?? '#999'} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PriorityPie({ team }: Props) {
  const data = Object.entries(team.priorityBreakdown)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));
  return (
    <div className="card chart-card">
      <h3>Open tasks by priority</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={90}
            label={(e) => `${e.name}: ${e.value}`}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={PRIORITY_COLORS[d.name] ?? '#999'} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBar({ team }: Props) {
  const data = team.categoryBreakdown.slice(0, 10);
  return (
    <div className="card chart-card">
      <h3>Open by category</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 32 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={140} />
          <Tooltip />
          <Bar dataKey="open" fill="#6a85ff" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ThroughputLine({ team }: Props) {
  return (
    <div className="card chart-card wide">
      <h3>Last 30 days: tasks created vs closed</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={team.closedPerDay}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => (d as string).slice(5)}
            interval={2}
          />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="created"
            stroke="#ff8a4d"
            strokeWidth={2}
            dot={false}
            name="Created"
          />
          <Line
            type="monotone"
            dataKey="closed"
            stroke="#30a56f"
            strokeWidth={2}
            dot={false}
            name="Closed"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
