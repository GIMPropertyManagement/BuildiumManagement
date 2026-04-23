import type { BankAccount, Reconciliation } from './types';

/**
 * Port of the SLA-breach logic from the Lambda. Classifies each bank account
 * (operating / reserve / CD) to pick an SLA limit (14d or 31d), fetches the
 * most recent reconciliation, and reports breaches.
 */

export type AccountType = 'operating' | 'reserve' | 'cd' | 'standard';
export type SlaStatus = 'OK' | 'BREACHED' | 'NO_DATA';

export interface SlaRow {
  id: number;
  name: string;
  type: AccountType;
  slaLimitDays: number;
  lastReconDate: string | null;
  daysAgo: number | null;
  status: SlaStatus;
  isBreached: boolean;
  note: string;
}

export interface SlaSummary {
  total: number;
  healthy: number;
  breached: number;
  noData: number;
  goodPercent: number;
  avgDaysLate: number;
}

// IDs excluded in the Lambda's SLA report (test / retired accounts).
const EXCLUDED_BANK_IDS = new Set<number>([255398, 270340]);

export function isEligibleForSla(account: BankAccount): boolean {
  if (!account.IsActive) return false;
  if (EXCLUDED_BANK_IDS.has(account.Id)) return false;
  return true;
}

export function classifyAccountType(name = ''): AccountType {
  const n = name.toLowerCase();
  if (n.includes('reserve')) return 'reserve';
  if (/\bcd\b/.test(n) || n.includes(' cd ')) return 'cd';
  if (n.includes('operating') || /\bopr\b/.test(n) || /\bop\b/.test(n)) {
    return 'operating';
  }
  return 'standard';
}

export function getSlaLimit(type: AccountType): number {
  return type === 'reserve' || type === 'cd' ? 31 : 14;
}

export function daysSince(dateStr: string | null, now = new Date()): number | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function evaluateSla(days: number | null, limit: number): {
  status: SlaStatus;
  breached: boolean;
} {
  if (days === null) return { status: 'NO_DATA', breached: true };
  if (days > limit) return { status: 'BREACHED', breached: true };
  return { status: 'OK', breached: false };
}

/** Mirrors the Lambda's pick: prefer most recent FINISHED recon, fall back to most recent. */
export function pickReconciliation(recs: Reconciliation[]): {
  date: string | null;
  note: string;
} {
  if (!recs || recs.length === 0) {
    return { date: null, note: 'No reconciliations found' };
  }
  const sorted = [...recs].sort((a, b) =>
    (b.StatementEndingDate || '').localeCompare(a.StatementEndingDate || ''),
  );
  const finished = sorted.find((r) => r.IsFinished === true);
  return finished
    ? { date: finished.StatementEndingDate, note: 'Finished' }
    : {
        date: sorted[0].StatementEndingDate,
        note: 'Most Recent (Unfinished)',
      };
}

export function bankAccountName(account: BankAccount): string {
  return account.GLAccount?.Name ?? account.Name ?? `Bank #${account.Id}`;
}

export function buildSlaRow(
  account: BankAccount,
  recs: Reconciliation[],
  now = new Date(),
): SlaRow {
  const name = bankAccountName(account);
  const type = classifyAccountType(name);
  const slaLimitDays = getSlaLimit(type);
  const { date, note } = pickReconciliation(recs);
  const daysAgo = daysSince(date, now);
  const { status, breached } = evaluateSla(daysAgo, slaLimitDays);
  return {
    id: account.Id,
    name,
    type,
    slaLimitDays,
    lastReconDate: date,
    daysAgo,
    status,
    isBreached: breached,
    note,
  };
}

export function summarizeSla(rows: SlaRow[]): SlaSummary {
  const total = rows.length;
  const healthy = rows.filter((r) => r.status === 'OK').length;
  const breached = rows.filter((r) => r.status === 'BREACHED').length;
  const noData = rows.filter((r) => r.status === 'NO_DATA').length;
  const goodPercent = total > 0 ? Math.round((healthy / total) * 100) : 0;
  const breachOverruns = rows
    .filter((r) => r.status === 'BREACHED' && r.daysAgo !== null)
    .map((r) => (r.daysAgo as number) - r.slaLimitDays);
  const avgDaysLate = breachOverruns.length
    ? Math.round(
        breachOverruns.reduce((s, n) => s + n, 0) / breachOverruns.length,
      )
    : 0;
  return { total, healthy, breached, noData, goodPercent, avgDaysLate };
}

export function buildiumBankRegisterUrl(bankAccountId: number): string {
  return `https://gimpm.managebuilding.com/manager/app/banking/bank-account/${bankAccountId}/register`;
}
