import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchActiveBankAccounts,
  fetchAssociations,
  fetchBankReconciliations,
  fetchBankTransactions,
  fetchGLBalancesForAssociation,
  mapWithConcurrency,
} from './client';
import {
  buildSlaRow,
  isEligibleForSla,
  summarizeSla,
  type SlaRow,
  type SlaSummary,
} from './slaAnalyzer';
import {
  extractContaminationFlags,
  summarizeContamination,
  type ContaminationAssociationResult,
  type ContaminationSummary,
} from './contaminationAnalyzer';
import {
  buildVendorProfiles,
  computeAuditWindow,
  flagAnomalies,
  toAuditable,
  type AuditFlag,
  type AuditWindow,
  type AuditableTransaction,
} from './bankAuditAnalyzer';
import type { BankAccount } from './types';

// Stay well under Buildium's 10 concurrent req/sec ceiling.
const SLA_CONCURRENCY = 4;
const CONTAMINATION_CONCURRENCY = 4;
const AUDIT_CONCURRENCY = 4;

interface LoadableState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  progress: { done: number; total: number } | null;
}

export interface SlaReport {
  rows: SlaRow[];
  summary: SlaSummary;
  generatedAt: Date;
}

export interface ContaminationReport {
  results: ContaminationAssociationResult[];
  summary: ContaminationSummary;
  asOfDate: string;
  generatedAt: Date;
}

export interface BankAuditReport {
  flags: AuditFlag[];
  window: AuditWindow;
  accountsScanned: number;
  accountsWithData: number;
  historyTransactionCount: number;
  auditTransactionCount: number;
  generatedAt: Date;
}

interface FinanceHook {
  sla: LoadableState<SlaReport>;
  contamination: LoadableState<ContaminationReport>;
  audit: LoadableState<BankAuditReport>;
  refreshSla: () => void;
  refreshContamination: () => void;
  runBankAudit: () => void;
}

function useLoadable<T>() {
  return useState<LoadableState<T>>({
    data: null,
    loading: false,
    error: null,
    progress: null,
  });
}

export function useFinanceData(): FinanceHook {
  const [sla, setSla] = useLoadable<SlaReport>();
  const [contamination, setContamination] = useLoadable<ContaminationReport>();
  const [audit, setAudit] = useLoadable<BankAuditReport>();

  const slaInFlight = useRef(false);
  const contInFlight = useRef(false);
  const auditInFlight = useRef(false);

  const runSla = useCallback(async () => {
    if (slaInFlight.current) return;
    slaInFlight.current = true;
    setSla((s) => ({ ...s, loading: true, error: null, progress: null }));
    try {
      const { items } = await fetchActiveBankAccounts();
      const eligible = items.filter(isEligibleForSla);
      setSla((s) => ({ ...s, progress: { done: 0, total: eligible.length } }));

      const rows = await mapWithConcurrency(
        eligible,
        SLA_CONCURRENCY,
        async (account) => {
          try {
            const recs = await fetchBankReconciliations(account.Id);
            return buildSlaRow(account, recs.items);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return buildSlaRow(account, [], new Date()) && {
              ...buildSlaRow(account, [], new Date()),
              note: `Fetch error: ${msg.slice(0, 40)}`,
            };
          }
        },
        (done, total) =>
          setSla((s) => ({ ...s, progress: { done, total } })),
      );

      const sorted = [...rows].sort((a, b) => (b.daysAgo ?? 9999) - (a.daysAgo ?? 9999));
      setSla({
        data: { rows: sorted, summary: summarizeSla(sorted), generatedAt: new Date() },
        loading: false,
        error: null,
        progress: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSla({ data: null, loading: false, error: msg, progress: null });
    } finally {
      slaInFlight.current = false;
    }
  }, [setSla]);

  const runContamination = useCallback(async () => {
    if (contInFlight.current) return;
    contInFlight.current = true;
    setContamination((s) => ({ ...s, loading: true, error: null, progress: null }));
    try {
      const { items } = await fetchAssociations();
      const active = items.filter((a) => a.IsActive);
      const asOfDate = new Date().toISOString().slice(0, 10);
      setContamination((s) => ({ ...s, progress: { done: 0, total: active.length } }));

      const results = await mapWithConcurrency(
        active,
        CONTAMINATION_CONCURRENCY,
        async (association): Promise<ContaminationAssociationResult> => {
          try {
            const { items: balances } = await fetchGLBalancesForAssociation(
              association.Id,
              asOfDate,
            );
            return {
              association,
              flags: extractContaminationFlags(association, balances),
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { association, flags: [], error: msg };
          }
        },
        (done, total) =>
          setContamination((s) => ({ ...s, progress: { done, total } })),
      );

      setContamination({
        data: {
          results,
          summary: summarizeContamination(results),
          asOfDate,
          generatedAt: new Date(),
        },
        loading: false,
        error: null,
        progress: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setContamination({ data: null, loading: false, error: msg, progress: null });
    } finally {
      contInFlight.current = false;
    }
  }, [setContamination]);

  const runAudit = useCallback(async () => {
    if (auditInFlight.current) return;
    auditInFlight.current = true;
    setAudit((s) => ({ ...s, loading: true, error: null, progress: null }));
    try {
      const window = computeAuditWindow();
      const { items: accounts } = await fetchActiveBankAccounts();
      const eligible = accounts.filter(isEligibleForSla);
      setAudit((s) => ({ ...s, progress: { done: 0, total: eligible.length } }));

      type AccountResult = {
        account: BankAccount;
        history: AuditableTransaction[];
        current: AuditableTransaction[];
      };

      const perAccount = await mapWithConcurrency<BankAccount, AccountResult>(
        eligible,
        AUDIT_CONCURRENCY,
        async (account): Promise<AccountResult> => {
          try {
            const { items } = await fetchBankTransactions(
              account.Id,
              window.historyStart,
              window.auditEnd,
            );
            const auditable = items.map((t) => toAuditable(t, account));
            const history: AuditableTransaction[] = [];
            const current: AuditableTransaction[] = [];
            for (const tx of auditable) {
              if (tx.date >= window.auditStart && tx.date < window.auditEnd) {
                current.push(tx);
              } else if (tx.date < window.auditStart) {
                history.push(tx);
              }
            }
            return { account, history, current };
          } catch {
            return { account, history: [], current: [] };
          }
        },
        (done, total) =>
          setAudit((s) => ({ ...s, progress: { done, total } })),
      );

      const history = perAccount.flatMap((a) => a.history);
      const current = perAccount.flatMap((a) => a.current);
      const accountsWithData = perAccount.filter((a) => a.current.length > 0).length;

      const profiles = buildVendorProfiles(history);
      const flags = flagAnomalies(current, profiles).sort((a, b) => {
        if (a.reason !== b.reason) return a.reason === 'NEW_VENDOR' ? -1 : 1;
        return Math.abs(b.amount) - Math.abs(a.amount);
      });

      setAudit({
        data: {
          flags,
          window,
          accountsScanned: eligible.length,
          accountsWithData,
          historyTransactionCount: history.length,
          auditTransactionCount: current.length,
          generatedAt: new Date(),
        },
        loading: false,
        error: null,
        progress: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAudit({ data: null, loading: false, error: msg, progress: null });
    } finally {
      auditInFlight.current = false;
    }
  }, [setAudit]);

  // Auto-load fast reports; gate the heavy one behind a button.
  useEffect(() => {
    runSla();
    runContamination();
  }, [runSla, runContamination]);

  return {
    sla,
    contamination,
    audit,
    refreshSla: runSla,
    refreshContamination: runContamination,
    runBankAudit: runAudit,
  };
}
