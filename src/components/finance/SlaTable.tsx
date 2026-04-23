import { ExternalLink } from 'lucide-react';
import type { SlaReport } from '../../finance/useFinanceData';
import { buildiumBankRegisterUrl } from '../../finance/slaAnalyzer';

interface Props {
  data: SlaReport;
}

function statusPill(status: string) {
  if (status === 'OK') return <span className="pill status-completed">OK</span>;
  if (status === 'BREACHED')
    return <span className="pill status-breached">Breached</span>;
  return <span className="pill status-deferred">No data</span>;
}

export function SlaTable({ data }: Props) {
  const { rows, summary } = data;
  const breaches = rows.filter((r) => r.isBreached);
  const healthy = rows.filter((r) => !r.isBreached);

  return (
    <>
      <div className="stat-strip">
        <StripCell label="Total" value={summary.total} />
        <StripCell label="Healthy" value={summary.healthy} tone="good" />
        <StripCell label="Breached" value={summary.breached} tone="bad" />
        <StripCell label="No data" value={summary.noData} tone="warn" />
        <StripCell label="Healthy %" value={`${summary.goodPercent}%`} />
      </div>

      {breaches.length ? (
        <>
          <h4>Breaches ({breaches.length})</h4>
          <table>
            <thead>
              <tr>
                <th>Bank account</th>
                <th>Type</th>
                <th>Last reconciled</th>
                <th className="num">Days</th>
                <th className="num">SLA</th>
                <th>Status</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {breaches.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="cell-strong">{r.name}</div>
                  </td>
                  <td>
                    <span className="type-pill">{r.type}</span>
                  </td>
                  <td>{r.lastReconDate ?? '—'}</td>
                  <td className="num alert">{r.daysAgo ?? '—'}</td>
                  <td className="num">{r.slaLimitDays}d</td>
                  <td>{statusPill(r.status)}</td>
                  <td className="muted">{r.note}</td>
                  <td>
                    <a
                      href={buildiumBankRegisterUrl(r.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="link-btn-inline"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      Open <ExternalLink size={11} strokeWidth={2} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div className="empty success">
          ✓ No breaches — everything is within SLA.
        </div>
      )}

      {healthy.length ? (
        <details className="healthy-details">
          <summary>Show {healthy.length} healthy accounts</summary>
          <table>
            <thead>
              <tr>
                <th>Bank account</th>
                <th>Type</th>
                <th>Last reconciled</th>
                <th className="num">Days</th>
                <th className="num">SLA</th>
              </tr>
            </thead>
            <tbody>
              {healthy.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="cell-strong">{r.name}</div>
                  </td>
                  <td>
                    <span className="type-pill">{r.type}</span>
                  </td>
                  <td>{r.lastReconDate ?? '—'}</td>
                  <td className="num">{r.daysAgo ?? '—'}</td>
                  <td className="num">{r.slaLimitDays}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </>
  );
}

function StripCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  return (
    <div className="strip-cell">
      <div className={`strip-value ${tone ?? ''}`}>{value}</div>
      <div className="strip-label">{label}</div>
    </div>
  );
}
