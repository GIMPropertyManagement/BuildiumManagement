import type { ContaminationReport } from '../../finance/useFinanceData';

interface Props {
  data: ContaminationReport;
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

export function ContaminationTable({ data }: Props) {
  const { results, summary } = data;
  const flagged = results.filter((r) => r.flags.length > 0);
  const errors = results.filter((r) => r.error);

  const flatFlags = flagged.flatMap((r) => r.flags);
  const sorted = [...flatFlags].sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
  );

  return (
    <>
      <div className="stat-strip">
        <StripCell label="Scanned" value={summary.associationsScanned} />
        <StripCell label="Flagged" value={summary.associationsFlagged} tone="bad" />
        <StripCell label="Healthy" value={summary.healthy} tone="good" />
        <StripCell label="Total flags" value={summary.totalFlags} />
        <StripCell
          label="Exposure"
          value={formatMoney(summary.totalExposure)}
          tone="bad"
        />
      </div>

      {errors.length ? (
        <div className="banner banner-warn">
          {errors.length} association{errors.length === 1 ? '' : 's'} failed to
          load GL balances and were skipped.
        </div>
      ) : null}

      {sorted.length ? (
        <table>
          <thead>
            <tr>
              <th>Association</th>
              <th>Suspicious GL account</th>
              <th>Type</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f) => (
              <tr key={`${f.associationId}-${f.glAccountId}`}>
                <td>
                  <div className="cell-strong">{f.associationName}</div>
                  <div className="task-sub">ID {f.associationId}</div>
                </td>
                <td>
                  <div className="cell-strong" style={{ color: 'var(--danger)' }}>
                    {f.glAccountName}
                  </div>
                  <div className="task-sub">GL #{f.glAccountId}</div>
                </td>
                <td>
                  <span className="type-pill">{f.glAccountType}</span>
                </td>
                <td className="num alert">{formatMoney(Math.abs(f.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty success">
          ✓ No cross-entity contamination detected.
        </div>
      )}
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
