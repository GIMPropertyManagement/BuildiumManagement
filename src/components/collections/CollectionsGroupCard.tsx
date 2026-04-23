import { ExternalLink, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { BalanceBucket } from '../../collections/types';
import type { CollectionsGroup } from '../../collections/analyzer';
import { bucketLabel } from '../../collections/analyzer';

interface Props {
  group: CollectionsGroup;
  bucket: BalanceBucket;
  initiallyOpen?: boolean;
}

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function CollectionsGroupCard({ group, bucket, initiallyOpen = true }: Props) {
  const [open, setOpen] = useState(initiallyOpen);
  const label = bucketLabel(bucket);

  return (
    <div className="card collection-group">
      <div
        className="collection-group-head"
        onClick={() => setOpen((v) => !v)}
        role="button"
      >
        <div>
          <h3>{group.associationName}</h3>
          <p className="card-sub">
            {group.rows.length} owner{group.rows.length === 1 ? '' : 's'} past
            due · <strong style={{ color: 'var(--danger)' }}>{formatMoney(group.bucketSubtotal)}</strong> in
            the {label} bucket · total balance{' '}
            <strong style={{ color: 'var(--fg-1)' }}>{formatMoney(group.totalSubtotal)}</strong>
          </p>
        </div>
        <ChevronDown
          size={18}
          strokeWidth={2}
          className="collection-chevron"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.15s ease',
            color: 'var(--fg-4)',
          }}
        />
      </div>

      {open ? (
        <table>
          <thead>
            <tr>
              <th>Address</th>
              <th>Owner</th>
              <th>Email</th>
              <th>Phone</th>
              <th className="num">0–30d</th>
              <th className="num">31–60d</th>
              <th className="num">61–90d</th>
              <th className="num">90d+</th>
              <th className="num">Total</th>
              <th>Last past-due email</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((r) => (
              <tr key={r.ownershipAccountId}>
                <td>
                  <div className="cell-strong">
                    {r.address || `Unit ${r.unitId}`}
                  </div>
                  {r.unitNumber ? (
                    <div className="task-sub">Unit {r.unitNumber}</div>
                  ) : null}
                </td>
                <td>
                  <a
                    href={r.ledgerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="task-link"
                    title="Open ledger in Buildium"
                  >
                    <div className="task-title">
                      {r.owner.name}
                      <ExternalLink
                        size={11}
                        strokeWidth={2}
                        className="task-link-icon"
                        aria-hidden
                      />
                    </div>
                    <div className="task-sub">#{r.ownershipAccountId}</div>
                  </a>
                </td>
                <td className="muted">{r.owner.email}</td>
                <td className="muted">{r.owner.phone}</td>
                <BucketCell amount={r.balance0To30} highlight={bucket === 'Balance0to30Days'} />
                <BucketCell amount={r.balance31To60} highlight={bucket === 'Balance31to60Days'} />
                <BucketCell amount={r.balance61To90} highlight={bucket === 'Balance61to90Days'} />
                <BucketCell amount={r.balanceOver90} highlight={bucket === 'BalanceOver90Days'} />
                <td className="num" style={{ color: 'var(--fg-1)' }}>
                  {formatMoney(r.totalBalance)}
                </td>
                <td className="muted">{formatDateShort(r.pastDueEmailSentDate)}</td>
                <td>
                  <a
                    href={r.ledgerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="link-btn-inline"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    Ledger <ExternalLink size={11} strokeWidth={2} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function BucketCell({ amount, highlight }: { amount: number; highlight: boolean }) {
  const hasAmount = amount > 0;
  return (
    <td
      className={`num ${highlight && hasAmount ? 'alert' : ''}`}
      style={{
        color: hasAmount
          ? highlight
            ? 'var(--danger)'
            : 'var(--fg-3)'
          : 'var(--fg-4)',
        fontWeight: highlight && hasAmount ? 700 : 500,
      }}
    >
      {hasAmount ? formatMoney(amount) : '—'}
    </td>
  );
}
