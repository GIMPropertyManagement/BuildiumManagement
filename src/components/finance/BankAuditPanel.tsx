import { ExternalLink } from 'lucide-react';
import type { BankAuditReport } from '../../finance/useFinanceData';
import { bankTransactionUrl } from '../../finance/bankAuditAnalyzer';

interface Props {
  data: BankAuditReport;
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

export function BankAuditPanel({ data }: Props) {
  const {
    flags,
    accountsScanned,
    accountsWithData,
    auditTransactionCount,
    historyTransactionCount,
  } = data;

  return (
    <>
      <div className="stat-strip">
        <StripCell label="Accounts scanned" value={accountsScanned} />
        <StripCell label="Accounts w/ txns" value={accountsWithData} />
        <StripCell label="Audit txns" value={auditTransactionCount} />
        <StripCell label="History txns" value={historyTransactionCount} />
        <StripCell
          label="Anomalies"
          value={flags.length}
          tone={flags.length ? 'warn' : 'good'}
        />
      </div>

      {flags.length ? (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Bank</th>
              <th>Payee</th>
              <th>Memo</th>
              <th>Reason</th>
              <th className="num">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.id}>
                <td>{f.date}</td>
                <td className="muted">{f.bankAccountName}</td>
                <td>
                  <div className="cell-strong">{f.payee}</div>
                  {f.checkNumber && f.checkNumber !== 'OTHR' ? (
                    <div className="task-sub">Check #{f.checkNumber}</div>
                  ) : null}
                </td>
                <td className="muted">{f.memo || '—'}</td>
                <td>
                  <span
                    className={`pill ${f.reason === 'NEW_VENDOR' ? 'status-new' : 'status-inprogress'}`}
                  >
                    {f.reason === 'NEW_VENDOR' ? 'New vendor' : 'Amount spike'}
                  </span>
                  <div className="task-sub">{f.detail}</div>
                </td>
                <td className="num alert">{formatMoney(Math.abs(f.amount))}</td>
                <td>
                  <a
                    href={bankTransactionUrl(f.bankAccountId, f.id)}
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
      ) : (
        <div className="empty success">
          ✓ No anomalies detected in the audit window.
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
