import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  badge?: string;
}

/**
 * 1×2 widget tile (Widgets Design System) — big Poppins number,
 * tiny uppercase label, optional tone chip at top-right.
 */
export function MetricCard({ label, value, hint, tone = 'neutral', badge }: MetricCardProps) {
  const toneClass = tone === 'neutral' ? '' : `tone-${tone}`;
  const autoBadge =
    badge ??
    (tone === 'good'
      ? 'On track'
      : tone === 'warn'
        ? 'Watch'
        : tone === 'bad'
          ? 'Alert'
          : undefined);
  return (
    <div className={`kpi ${toneClass}`}>
      <div className="kpi-top">
        <div className="kpi-label">{label}</div>
        {autoBadge ? <div className="kpi-chip">{autoBadge}</div> : null}
      </div>
      <div className="kpi-value">{value}</div>
      {hint ? <div className="kpi-hint">{hint}</div> : null}
    </div>
  );
}
