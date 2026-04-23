import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TeamMetrics } from '../buildium/metrics';

const STATUS_COLORS: Record<string, string> = {
  New: '#0496FF',
  InProgress: '#FDCA40',
  Deferred: '#6665DD',
  Completed: '#7ED321',
  Closed: '#34D1BF',
};

const PRIORITY_COLORS: Record<string, string> = {
  High: '#FF715B',
  Normal: '#0496FF',
  Low: '#A2C4D4',
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
      <h3>Status breakdown</h3>
      <p className="card-sub">Open + recently closed tasks.</p>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={90}
            innerRadius={55}
            paddingAngle={2}
            stroke="none"
            label={(e) => `${e.name}: ${e.value}`}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={STATUS_COLORS[d.name] ?? '#A2C4D4'} />
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
      <h3>Priority mix</h3>
      <p className="card-sub">All open tasks.</p>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={90}
            innerRadius={55}
            paddingAngle={2}
            stroke="none"
            label={(e) => `${e.name}: ${e.value}`}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={PRIORITY_COLORS[d.name] ?? '#A2C4D4'} />
            ))}
          </Pie>
          <Tooltip />
          <Legend iconType="circle" />
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
      <p className="card-sub">Top 10 categories.</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 11 }}
          />
          <Tooltip cursor={{ fill: 'rgba(4, 150, 255, 0.06)' }} />
          <Bar dataKey="open" fill="#0496FF" radius={[3, 3, 3, 3]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ThroughputLine({ team }: Props) {
  return (
    <div className="card chart-card wide">
      <h3>Throughput — last 30 days</h3>
      <p className="card-sub">Tasks created vs closed per day.</p>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={team.closedPerDay}>
          <defs>
            <linearGradient id="areaCreated" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#FF715B" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#FF715B" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="areaClosed" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0496FF" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#0496FF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => (d as string).slice(5)}
            interval={3}
          />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend iconType="circle" />
          <Area
            type="monotone"
            dataKey="created"
            stroke="#FF715B"
            strokeWidth={2.5}
            fill="url(#areaCreated)"
            dot={false}
            name="Created"
          />
          <Area
            type="monotone"
            dataKey="closed"
            stroke="#0496FF"
            strokeWidth={2.5}
            fill="url(#areaClosed)"
            dot={false}
            name="Closed"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
