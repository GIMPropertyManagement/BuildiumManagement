import type {
  AssociationOwner,
  AssociationUnit,
  BalanceBucket,
  OutstandingBalance,
  OwnershipAccount,
} from './types';

/**
 * Group + enrich the outstanding-balances payload into something
 * display-ready. Mirrors the Lambda email's logic:
 *   - Filter out ownership accounts marked `InCollections`
 *   - Enrich with owner contact + unit address from side maps
 *   - Sort balances within an association by the chosen bucket (desc)
 *   - Sort associations alphabetically
 */

export interface OwnerContact {
  name: string;
  email: string;
  phone: string;
}

export interface CollectionsRow {
  ownershipAccountId: number;
  unitId: number;
  address: string;
  unitNumber: string | null;
  owner: OwnerContact;
  balance0To30: number;
  balance31To60: number;
  balance61To90: number;
  balanceOver90: number;
  totalBalance: number;
  bucketAmount: number;
  pastDueEmailSentDate: string | null;
  delinquencyStatus: string;
  ledgerUrl: string;
}

export interface CollectionsGroup {
  associationId: number;
  associationName: string;
  rows: CollectionsRow[];
  bucketSubtotal: number;
  totalSubtotal: number;
}

export interface CollectionsSummary {
  associationCount: number;
  ownerCount: number;
  bucketTotal: number;
  totalBalance: number;
  excludedInCollections: number;
}

export function ownerContactFrom(owner: AssociationOwner | undefined): OwnerContact {
  if (!owner) return { name: 'N/A', email: 'N/A', phone: 'N/A' };
  const name =
    `${owner.FirstName ?? ''} ${owner.LastName ?? ''}`.trim() || 'N/A';
  const email = owner.Email || owner.AlternateEmail || 'N/A';
  const phone =
    owner.PhoneNumbers?.[0]?.Number ||
    owner.EmergencyContact?.Phone ||
    'N/A';
  return { name, email, phone };
}

export function buildOwnerMaps(owners: AssociationOwner[]): {
  byOwnershipAccountId: Map<number, AssociationOwner>;
  byUnitId: Map<number, AssociationOwner>;
} {
  const byOwnershipAccountId = new Map<number, AssociationOwner>();
  const byUnitId = new Map<number, AssociationOwner>();
  for (const owner of owners) {
    for (const acct of owner.OwnershipAccounts || []) {
      if (acct.Id && !byOwnershipAccountId.has(acct.Id)) {
        byOwnershipAccountId.set(acct.Id, owner);
      }
      if (acct.UnitId && !byUnitId.has(acct.UnitId)) {
        byUnitId.set(acct.UnitId, owner);
      }
    }
  }
  return { byOwnershipAccountId, byUnitId };
}

export function buildDelinquencyMap(
  accounts: OwnershipAccount[],
): Map<number, string> {
  const m = new Map<number, string>();
  for (const a of accounts) {
    m.set(a.Id, a.DelinquencyStatus || 'NoDelinquency');
  }
  return m;
}

export function formatAddress(unit: AssociationUnit | undefined): string {
  if (!unit?.Address) return unit ? `Unit ${unit.Id}` : '';
  const a = unit.Address;
  const line1 = a.AddressLine1 ? a.AddressLine1 : '';
  const city = a.City ? a.City : '';
  const state = a.State ? a.State : '';
  const zip = a.PostalCode ? a.PostalCode : '';
  return [line1, [city, state].filter(Boolean).join(', '), zip]
    .filter(Boolean)
    .join(' · ')
    .trim();
}

export function ownershipAccountLedgerUrl(ownershipAccountId: number): string {
  return `https://gimpm.managebuilding.com/manager/app/associations/ownership-accounts/${ownershipAccountId}/financials/ledger?isByDateView=1`;
}

function pickBucketField(balance: OutstandingBalance, bucket: BalanceBucket): number {
  switch (bucket) {
    case 'Balance0to30Days':
      return Number(balance.Balance0To30Days ?? 0);
    case 'Balance31to60Days':
      return Number(balance.Balance31To60Days ?? 0);
    case 'Balance61to90Days':
      return Number(balance.Balance61To90Days ?? 0);
    case 'BalanceOver90Days':
      return Number(balance.BalanceOver90Days ?? 0);
  }
}

export interface BuildGroupsArgs {
  associationNameById: Map<number, string>;
  balancesByAssociation: Map<number, OutstandingBalance[]>;
  ownerByOwnershipAccountId: Map<number, AssociationOwner>;
  ownerByUnitId: Map<number, AssociationOwner>;
  delinquencyByOwnershipAccountId: Map<number, string>;
  unitById: Map<number, AssociationUnit>;
  bucket: BalanceBucket;
}

export function buildCollectionsGroups({
  associationNameById,
  balancesByAssociation,
  ownerByOwnershipAccountId,
  ownerByUnitId,
  delinquencyByOwnershipAccountId,
  unitById,
  bucket,
}: BuildGroupsArgs): {
  groups: CollectionsGroup[];
  excludedInCollections: number;
} {
  const groups: CollectionsGroup[] = [];
  let excludedInCollections = 0;

  for (const [associationId, balances] of balancesByAssociation) {
    const rows: CollectionsRow[] = [];
    for (const b of balances) {
      const delinquencyStatus =
        delinquencyByOwnershipAccountId.get(b.OwnershipAccountId) ??
        'NoDelinquency';
      if (delinquencyStatus === 'InCollections') {
        excludedInCollections += 1;
        continue;
      }
      const owner =
        ownerByOwnershipAccountId.get(b.OwnershipAccountId) ??
        ownerByUnitId.get(b.UnitId);
      const unit = unitById.get(b.UnitId);
      rows.push({
        ownershipAccountId: b.OwnershipAccountId,
        unitId: b.UnitId,
        address: formatAddress(unit),
        unitNumber: unit?.UnitNumber ?? null,
        owner: ownerContactFrom(owner),
        balance0To30: Number(b.Balance0To30Days ?? 0),
        balance31To60: Number(b.Balance31To60Days ?? 0),
        balance61To90: Number(b.Balance61To90Days ?? 0),
        balanceOver90: Number(b.BalanceOver90Days ?? 0),
        totalBalance: Number(b.TotalBalance ?? 0),
        bucketAmount: pickBucketField(b, bucket),
        pastDueEmailSentDate: b.PastDueEmailSentDate,
        delinquencyStatus,
        ledgerUrl: ownershipAccountLedgerUrl(b.OwnershipAccountId),
      });
    }

    if (rows.length === 0) continue;

    rows.sort((a, b) => b.bucketAmount - a.bucketAmount);
    const bucketSubtotal = rows.reduce((s, r) => s + r.bucketAmount, 0);
    const totalSubtotal = rows.reduce((s, r) => s + r.totalBalance, 0);

    groups.push({
      associationId,
      associationName:
        associationNameById.get(associationId) ?? `Association ${associationId}`,
      rows,
      bucketSubtotal,
      totalSubtotal,
    });
  }

  groups.sort((a, b) => a.associationName.localeCompare(b.associationName));
  return { groups, excludedInCollections };
}

export function summarizeCollections(
  groups: CollectionsGroup[],
  excludedInCollections: number,
): CollectionsSummary {
  const associationCount = groups.length;
  const ownerCount = groups.reduce((s, g) => s + g.rows.length, 0);
  const bucketTotal = groups.reduce((s, g) => s + g.bucketSubtotal, 0);
  const totalBalance = groups.reduce((s, g) => s + g.totalSubtotal, 0);
  return {
    associationCount,
    ownerCount,
    bucketTotal,
    totalBalance,
    excludedInCollections,
  };
}

export const BUCKET_OPTIONS: Array<{ value: BalanceBucket; label: string }> = [
  { value: 'Balance0to30Days', label: '0–30 days' },
  { value: 'Balance31to60Days', label: '31–60 days' },
  { value: 'Balance61to90Days', label: '61–90 days' },
  { value: 'BalanceOver90Days', label: 'Over 90 days' },
];

export function bucketLabel(bucket: BalanceBucket): string {
  return (
    BUCKET_OPTIONS.find((b) => b.value === bucket)?.label ?? '61–90 days'
  );
}
