import type { Association, GLBalanceEntry } from './types';

/**
 * Port of the cross-entity contamination analyzer. For each active association
 * we pull its GL balances and flag any GL account whose name refers to *another*
 * entity (a partial/fuzzy match failure against the owning association).
 *
 * Two layers of allow-listing:
 *  1. SAFE_SYSTEM_ACCOUNTS — shared chart-of-accounts names that legitimately
 *     appear on every association.
 *  2. SAFE_GL_NAME_CONTAINS — explicit per-customer exemptions.
 *
 * Anything that passes both lists is matched token-by-token against the
 * association name. Mismatch → contamination flag.
 */

const SAFE_SYSTEM_ACCOUNTS = [
  'undeposited funds',
  'accounts receivable',
  'accounts payable',
  'prepaid rent',
  'prepayments',
  'loan payable',
  'notes payable',
  'interest payable',
  'security deposit liability',
  'opening balance equity',
  'retained earnings',
  'suspense',
  'due to',
  'due from',
  'funds in transit',
  'capital expenditure',
  'prepaid expenses',
  'unit owner windows & doors',
];

const SAFE_GL_NAME_CONTAINS = [
  'owner opening balances prior management',
  'accrued expenses',
  'prepaid insurance',
  'gim property management llc rent',
  'owner reimbursable charges',
];

const NOISE_WORDS = new Set([
  'the', 'at', 'of', 'and', '&',
  'condominium', 'condominiums', 'condo', 'association', 'assn',
  'trust', 'hoa', 'homeowners', 'estates', 'properties', 'llc', 'inc',
  'st', 'street', 'ave', 'avenue', 'rd', 'road', 'pl', 'place',
]);

function cleanString(str: string | null | undefined): string {
  return String(str ?? '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSignificantTokens(fullName: string | null | undefined): string[] {
  const name = cleanString(fullName);
  if (!name) return [];
  return name.split(/\s+/).filter((w) => w.length > 2 && !NOISE_WORDS.has(w));
}

export function isSuspicious(assocName: string, glName: string): boolean {
  const glClean = cleanString(glName);

  if (SAFE_GL_NAME_CONTAINS.some((safe) => glClean.includes(safe))) return false;
  if (SAFE_SYSTEM_ACCOUNTS.some((safe) => glClean.includes(safe))) return false;

  // Mirror of the Lambda's aggressive rule: any "gim property" or bare "rent"
  // reference on an association is a contamination smell.
  if (glClean.includes('gim property') || glClean.includes('rent')) return true;

  const assocTokens = getSignificantTokens(assocName);
  const glTokens = getSignificantTokens(glName);
  if (assocTokens.length === 0) return false;
  if (glTokens.includes(assocTokens[0])) return false;

  const assocJoined = assocTokens.join('');
  const glJoined = glTokens.join('');
  if (glJoined.includes(assocJoined) || assocJoined.includes(glJoined)) return false;

  return true;
}

export interface ContaminationFlag {
  associationId: number;
  associationName: string;
  glAccountId: number;
  glAccountName: string;
  glAccountType: string;
  amount: number;
}

export interface ContaminationAssociationResult {
  association: Association;
  flags: ContaminationFlag[];
  error?: string;
}

export function extractContaminationFlags(
  assoc: Association,
  balances: GLBalanceEntry[],
): ContaminationFlag[] {
  const flags: ContaminationFlag[] = [];
  for (const entry of balances) {
    const gl = entry.GLAccount;
    if (!gl) continue;
    const type = (gl.Type ?? '').toLowerCase();
    const name = gl.Name ?? '';
    const balance = Number(entry.TotalBalance ?? 0);

    // Mirror Lambda filter: real money only, asset/liability/bank accounts.
    if (Math.abs(balance) < 0.01) continue;
    if (!type.includes('asset') && !type.includes('liability') && !type.includes('bank')) {
      continue;
    }
    if (!isSuspicious(assoc.Name, name)) continue;

    flags.push({
      associationId: assoc.Id,
      associationName: assoc.Name,
      glAccountId: gl.Id,
      glAccountName: name,
      glAccountType: gl.Type,
      amount: balance,
    });
  }
  return flags;
}

export interface ContaminationSummary {
  associationsScanned: number;
  associationsFlagged: number;
  totalFlags: number;
  totalExposure: number;
  healthy: number;
}

export function summarizeContamination(
  results: ContaminationAssociationResult[],
): ContaminationSummary {
  const associationsScanned = results.length;
  const flagged = results.filter((r) => r.flags.length > 0);
  const totalFlags = results.reduce((s, r) => s + r.flags.length, 0);
  const totalExposure = results.reduce(
    (s, r) => s + r.flags.reduce((ss, f) => ss + Math.abs(f.amount), 0),
    0,
  );
  return {
    associationsScanned,
    associationsFlagged: flagged.length,
    totalFlags,
    totalExposure,
    healthy: associationsScanned - flagged.length,
  };
}
