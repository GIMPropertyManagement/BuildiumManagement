import type { SlaReport } from '../../finance/useFinanceData';
import { buildiumBankRegisterUrl } from '../../finance/slaAnalyzer';

interface Props {
  data: SlaReport;
}

function statusPill(status: string) {
  const cls =
    status === 'OK'
      ? 'pill status-completed'
      : status === 'BREACHED'
        ? 'pill status-breached'
        : 'pill status-deferred';
  return <span className={cls}>{status === 'NO_DATA' ? 'No data' : status}</span>;
}

export function SlaTable({ data }: Props) {
  const { rows, summary } = data;
  const breaches = rows.filter((r) => r.isBreached);
  const healthy = rows.filter((r) => !r.isBreached);

  return (
    <>
      <div className="sla-stats">
        <Stat label="Total" value={summary.total} />
        <Stat label="Healthy" value={summary.healthy} tone="good" />
        <Stat label="Breached" value={summary.breached} tone="bad" />
        <Stat label="No data" value={summary.noData} tone="warn" />
        <Stat label="Healthy %" value={`${summary.goodPercent}%`} />
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
                <th className="num">Days ago</th>
                <th className="num">SLA</th>
                <th>Status</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {breaches.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
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
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div className="empty success">✅ No breaches. Everything is within SLA.</div>
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
                <th className="num">Days ago</th>
                <th className="num">SLA</th>
              </tr>
            </thead>
            <tbody>
              {healthy.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  return (
    <div className={`stat stat-inline ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
