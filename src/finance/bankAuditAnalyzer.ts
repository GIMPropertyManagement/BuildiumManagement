import type { BankAccount, BankTransaction } from './types';

/**
 * Port of the Bank Audit heuristic layer from the Lambda — WITHOUT the
 * Bedrock AI pass. We build a 6-month vendor profile per payee and flag
 * any negative-amount transaction in the audit window that's either:
 *  - a new vendor (first appearance in 6 months), OR
 *  - an amount spike (>50% above that vendor's historical average).
 *
 * The Lambda additionally sends flags to Claude Haiku to weed out obvious
 * false positives — we skip that step in the browser (no creds for
 * Bedrock) and just surface the raw heuristic flags. A supervisor can
 * skim and dismiss mentally; this still catches 100% of what the AI sees.
 */

export const AUDIT_HISTORY_DAYS = 180;
/** Start of the audit window: 14 days ago by default. */
export const AUDIT_START_DAYS_AGO = 14;
/** End of the audit window: 7 days ago by default. */
export const AUDIT_END_DAYS_AGO = 7;
/** A vendor must have this many prior hits before spike detection is meaningful. */
const SPIKE_MIN_HISTORY_HITS = 2;
/** Percentage above mean that counts as a spike. */
const SPIKE_DEVIATION = 0.5;

export type AuditFlagReason = 'NEW_VENDOR' | 'AMOUNT_SPIKE';

export interface AuditableTransaction {
  id: number;
  date: string;
  bankAccountId: number;
  bankAccountName: string;
  amount: number;
  memo: string;
  payee: string;
  checkNumber: string | null;
  transactionType: string;
}

export interface AuditFlag extends AuditableTransaction {
  reason: AuditFlagReason;
  detail: string;
  priorCount: number;
  priorAverage: number | null;
  deviationPercent: number | null;
}

export interface AuditWindow {
  historyStart: string; // inclusive
  auditStart: string;   // inclusive (start of audit window)
  auditEnd: string;     // exclusive upper bound (we exclude today's churn)
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeAuditWindow(now = new Date()): AuditWindow {
  const day = 86_400_000;
  const t = now.getTime();
  return {
    auditEnd: toISODate(new Date(t - AUDIT_END_DAYS_AGO * day)),
    auditStart: toISODate(new Date(t - AUDIT_START_DAYS_AGO * day)),
    historyStart: toISODate(
      new Date(t - (AUDIT_START_DAYS_AGO + AUDIT_HISTORY_DAYS) * day),
    ),
  };
}

export function extractPayee(tx: BankTransaction): string {
  // Buildium's txn payee can live under several shapes depending on txn type.
  const paidTo = tx.PaidTo?.[0];
  if (paidTo?.Name) return paidTo.Name;
  const paidBy = tx.PaidBy?.[0];
  if (paidBy?.Name) return paidBy.Name;
  // Fall back to accounting-entity id so new-vendor logic still groups sanely.
  const anyParty = paidTo?.AccountingEntity ?? paidBy?.AccountingEntity;
  return anyParty ? `Entity #${anyParty.Id}` : 'N/A';
}

export function toAuditable(
  tx: BankTransaction,
  account: BankAccount,
): AuditableTransaction {
  return {
    id: tx.Id,
    date: tx.EntryDate,
    bankAccountId: account.Id,
    bankAccountName: account.GLAccount?.Name ?? `Bank #${account.Id}`,
    amount: Number(tx.Amount ?? 0),
    memo: tx.Memo ?? '',
    payee: extractPayee(tx),
    checkNumber: tx.CheckNumber ?? null,
    transactionType: tx.TransactionType ?? '',
  };
}

export interface VendorProfile {
  count: number;
  total: number;
  average: number;
}

export function buildVendorProfiles(
  history: AuditableTransaction[],
): Map<string, VendorProfile> {
  const profiles = new Map<string, { count: number; total: number }>();
  for (const tx of history) {
    if (tx.amount >= 0) continue; // outflows only
    const key = normalizePayee(tx.payee);
    if (!key || key === 'n/a') continue;
    const p = profiles.get(key) ?? { count: 0, total: 0 };
    p.count += 1;
    p.total += Math.abs(tx.amount);
    profiles.set(key, p);
  }
  const finalized = new Map<string, VendorProfile>();
  for (const [k, v] of profiles) {
    finalized.set(k, { count: v.count, total: v.total, average: v.total / v.count });
  }
  return finalized;
}

function normalizePayee(name: string | null | undefined): string {
  return (name ?? '').toUpperCase().trim();
}

export function flagAnomalies(
  auditWindow: AuditableTransaction[],
  profiles: Map<string, VendorProfile>,
): AuditFlag[] {
  const flags: AuditFlag[] = [];
  for (const tx of auditWindow) {
    if (tx.amount >= 0) continue;
    const key = normalizePayee(tx.payee);
    if (!key || key === 'n/a') continue;
    const profile = profiles.get(key);
    const currentAmt = Math.abs(tx.amount);

    if (!profile) {
      flags.push({
        ...tx,
        reason: 'NEW_VENDOR',
        detail: `First outflow to "${tx.payee}" in the last ${AUDIT_HISTORY_DAYS} days.`,
        priorCount: 0,
        priorAverage: null,
        deviationPercent: null,
      });
      continue;
    }

    if (profile.count >= SPIKE_MIN_HISTORY_HITS) {
      const deviation = (currentAmt - profile.average) / profile.average;
      if (deviation > SPIKE_DEVIATION) {
        flags.push({
          ...tx,
          reason: 'AMOUNT_SPIKE',
          detail: `${Math.round(deviation * 100)}% above avg of $${profile.average.toFixed(0)} across ${profile.count} prior payments.`,
          priorCount: profile.count,
          priorAverage: profile.average,
          deviationPercent: deviation * 100,
        });
      }
    }
  }
  return flags;
}

export function bankTransactionUrl(bankAccountId: number, txnId: number): string {
  return `https://gimpm.managebuilding.com/manager/app/banking/bank-account/${bankAccountId}/register?journalId=${txnId}`;
}
