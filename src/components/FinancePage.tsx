import { useFinanceData } from '../finance/useFinanceData';
import { MetricCard } from './MetricCard';
import { SlaTable } from './finance/SlaTable';
import { ContaminationTable } from './finance/ContaminationTable';
import { BankAuditPanel } from './finance/BankAuditPanel';

interface FinancePageProps {
  onSignOut: () => void;
  userEmail?: string;
  onNavigate: (page: 'tasks' | 'finance') => void;
}

function timeAgo(d: Date) {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function FinancePage({ onSignOut, userEmail, onNavigate }: FinancePageProps) {
  const {
    sla,
    contamination,
    audit,
    refreshSla,
    refreshContamination,
    runBankAudit,
  } = useFinanceData();

  const anyLoading = sla.loading || contamination.loading || audit.loading;

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <h1>Finance Control Room</h1>
          <p className="subtitle">
            SLA, contamination and bank-audit signals from Buildium
          </p>
        </div>
        <div className="topbar-actions">
          <nav className="page-nav">
            <button onClick={() => onNavigate('tasks')}>Tasks</button>
            <button className="active">Finance</button>
          </nav>
          <div className="user-chip">
            <span>{userEmail ?? 'Signed in'}</span>
            <button className="link-btn" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="metric-row">
        <MetricCard
          label="SLA breaches"
          value={sla.data?.summary.breached ?? (sla.loading ? '…' : '—')}
          hint={sla.data ? `${sla.data.summary.goodPercent}% healthy` : undefined}
          tone={
            !sla.data
              ? 'neutral'
              : sla.data.summary.breached === 0
                ? 'good'
                : sla.data.summary.breached > 10
                  ? 'bad'
                  : 'warn'
          }
        />
        <MetricCard
          label="Avg days past SLA"
          value={sla.data ? `${sla.data.summary.avgDaysLate}d` : '—'}
          hint="Across breached accounts"
          tone={sla.data && sla.data.summary.avgDaysLate > 14 ? 'bad' : 'neutral'}
        />
        <MetricCard
          label="Contamination flags"
          value={
            contamination.data?.summary.totalFlags ??
            (contamination.loading ? '…' : '—')
          }
          hint={
            contamination.data
              ? `${contamination.data.summary.associationsFlagged}/${contamination.data.summary.associationsScanned} associations`
              : undefined
          }
          tone={
            !contamination.data
              ? 'neutral'
              : contamination.data.summary.totalFlags === 0
                ? 'good'
                : 'bad'
          }
        />
        <MetricCard
          label="Contamination exposure"
          value={
            contamination.data
              ? `$${Math.round(contamination.data.summary.totalExposure).toLocaleString()}`
              : '—'
          }
          hint="Sum of absolute flagged balances"
          tone={
            contamination.data && contamination.data.summary.totalExposure > 5000
              ? 'bad'
              : 'neutral'
          }
        />
        <MetricCard
          label="Audit anomalies"
          value={audit.data?.flags.length ?? (audit.loading ? '…' : '—')}
          hint={
            audit.data
              ? `${audit.data.auditTransactionCount} txns scanned`
              : 'Run on-demand'
          }
          tone={
            !audit.data
              ? 'neutral'
              : audit.data.flags.length === 0
                ? 'good'
                : 'warn'
          }
        />
      </section>

      <section className="card finance-section">
        <div className="finance-section-head">
          <div>
            <h2>Reconciliation SLA</h2>
            <p className="card-sub">
              Operating / Standard = 14 day SLA · Reserve / CD = 31 days. Most
              recent finished reconciliation drives the clock.
            </p>
          </div>
          <div className="finance-section-meta">
            {sla.data ? (
              <span className="muted">Updated {timeAgo(sla.data.generatedAt)}</span>
            ) : null}
            <button onClick={refreshSla} disabled={sla.loading}>
              {sla.loading ? 'Scanning…' : 'Refresh'}
            </button>
          </div>
        </div>
        {sla.error ? <div className="banner banner-error">{sla.error}</div> : null}
        {sla.progress && sla.loading ? (
          <div className="progress">
            Checking reconciliations {sla.progress.done}/{sla.progress.total}
          </div>
        ) : null}
        {sla.data ? <SlaTable data={sla.data} /> : null}
      </section>

      <section className="card finance-section">
        <div className="finance-section-head">
          <div>
            <h2>Cross-Entity Contamination</h2>
            <p className="card-sub">
              GL balances on an association that reference a different entity's
              name. Allow-lists hide shared system accounts and GIM-specific
              exemptions.
            </p>
          </div>
          <div className="finance-section-meta">
            {contamination.data ? (
              <span className="muted">
                As of {contamination.data.asOfDate} · Updated{' '}
                {timeAgo(contamination.data.generatedAt)}
              </span>
            ) : null}
            <button
              onClick={refreshContamination}
              disabled={contamination.loading}
            >
              {contamination.loading ? 'Scanning…' : 'Refresh'}
            </button>
          </div>
        </div>
        {contamination.error ? (
          <div className="banner banner-error">{contamination.error}</div>
        ) : null}
        {contamination.progress && contamination.loading ? (
          <div className="progress">
            Scanning associations {contamination.progress.done}/
            {contamination.progress.total}
          </div>
        ) : null}
        {contamination.data ? (
          <ContaminationTable data={contamination.data} />
        ) : null}
      </section>

      <section className="card finance-section">
        <div className="finance-section-head">
          <div>
            <h2>Bank Anomaly Audit</h2>
            <p className="card-sub">
              Scans the reconciled week (7–14 days ago) against 6 months of
              history. Flags new vendors and &gt;50% amount spikes. Heuristics
              only — no AI pass.
            </p>
          </div>
          <div className="finance-section-meta">
            {audit.data ? (
              <span className="muted">
                {audit.data.window.auditStart} → {audit.data.window.auditEnd} ·
                Updated {timeAgo(audit.data.generatedAt)}
              </span>
            ) : null}
            <button onClick={runBankAudit} disabled={audit.loading}>
              {audit.loading ? 'Auditing…' : audit.data ? 'Re-run audit' : 'Run audit'}
            </button>
          </div>
        </div>
        {audit.error ? <div className="banner banner-error">{audit.error}</div> : null}
        {audit.progress && audit.loading ? (
          <div className="progress">
            Pulling transactions {audit.progress.done}/{audit.progress.total} accounts
          </div>
        ) : null}
        {audit.data ? <BankAuditPanel data={audit.data} /> : (
          <div className="empty">
            Audit runs on demand — fetches ~6 months of transactions across every
            active bank account (a few minutes end-to-end). Hit "Run audit" when
            you're ready.
          </div>
        )}
      </section>

      <footer className="footer">
        {anyLoading ? 'Loading finance data…' : 'All reports idle.'} Each
        report fans out to the Buildium API with bounded concurrency to stay
        under the 10-req/s rate limit.
      </footer>
    </div>
  );
}
