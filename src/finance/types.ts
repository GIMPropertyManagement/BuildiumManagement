/**
 * Shapes for the finance endpoints. Captured from live Buildium responses.
 */

export interface GLAccountRef {
  Id: number;
  AccountNumber: string | null;
  Name: string;
  Description: string | null;
  Type: string;
  SubType: string | null;
  IsActive: boolean;
  IsBankAccount: boolean;
  IsCreditCardAccount: boolean;
}

export interface BankAccount {
  Id: number;
  GLAccount: GLAccountRef;
  IsActive: boolean;
  Name?: string;
}

export interface Association {
  Id: number;
  Name: string;
  IsActive: boolean;
  OperatingBankAccount: string | null;
  OperatingBankAccountId: number | null;
  Address: {
    AddressLine1: string;
    City: string;
    State: string;
    PostalCode: string;
  } | null;
}

export interface Reconciliation {
  Id: number;
  IsFinished: boolean;
  StatementEndingDate: string | null;
}

export interface AccountingEntity {
  Id: number;
  AccountingEntityType: string;
  Href: string;
  Unit: unknown | null;
}

export interface BankTransactionParty {
  AccountingEntity: AccountingEntity;
  Amount: number;
  Name?: string | null;
}

export interface BankTransaction {
  Id: number;
  EntryDate: string;
  TransactionType: string;
  CheckNumber: string | null;
  Memo: string | null;
  Amount: number;
  ReconciliationStatus: string | null;
  PaidBy: BankTransactionParty[] | null;
  PaidTo: BankTransactionParty[] | null;
  Balance: number | null;
}

export interface GLBalanceEntry {
  TotalBalance: number;
  GLAccount: GLAccountRef;
  AccountingEntityBalances: Array<{
    Balance: number;
    AccountingEntity: AccountingEntity;
  }>;
}
