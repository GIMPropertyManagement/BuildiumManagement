import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}

export function MetricCard({ label, value, hint, tone = 'neutral' }: MetricCardProps) {
  return (
    <div className={`metric-card tone-${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </div>
  );
}
