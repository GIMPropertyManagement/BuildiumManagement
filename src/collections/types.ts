/**
 * Buildium collections-related shapes. Only the fields this dashboard reads.
 */

export type DelinquencyStatus =
  | 'NoDelinquency'
  | 'InCollections'
  | 'Delinquent'
  | string;

export type BalanceBucket =
  | 'Balance0to30Days'
  | 'Balance31to60Days'
  | 'Balance61to90Days'
  | 'BalanceOver90Days';

export interface OwnerOwnershipAccountRef {
  Id: number;
  AssociationId: number;
  UnitId: number;
  Status: string;
  DateOfPurchase: string | null;
  DateOfSale: string | null;
  AssociationOwnerIds: number[];
  DelinquencyStatus: DelinquencyStatus;
}

export interface OwnerAddress {
  AddressLine1: string;
  AddressLine2: string;
  AddressLine3: string;
  City: string;
  State: string;
  PostalCode: string;
  Country: string;
}

export interface AssociationOwner {
  Id: number;
  FirstName: string | null;
  LastName: string | null;
  Email: string | null;
  AlternateEmail: string | null;
  PhoneNumbers: Array<{ Number: string; Type: string }>;
  PrimaryAddress: OwnerAddress | null;
  EmergencyContact: {
    Name: string | null;
    RelationshipDescription: string | null;
    Phone: string | null;
    Email: string | null;
  } | null;
  OwnershipAccounts: OwnerOwnershipAccountRef[];
  OccupiesUnit: boolean;
}

export interface OwnershipAccount {
  Id: number;
  AssociationId: number;
  UnitId: number;
  Status: string;
  DelinquencyStatus: DelinquencyStatus;
  AssociationOwnerIds: number[];
}

export interface AssociationUnit {
  Id: number;
  AssociationId: number;
  AssociationName: string;
  UnitNumber: string | null;
  Address: OwnerAddress | null;
  UnitBedrooms?: string;
  UnitBathrooms?: string;
  UnitSize?: number | null;
}

export interface OutstandingBalance {
  OwnershipAccountId: number;
  AssociationId: number;
  UnitId: number;
  Balance0To30Days: number;
  Balance31To60Days: number;
  Balance61To90Days: number;
  BalanceOver90Days: number;
  TotalBalance: number;
  Balances: Array<{ GlAccountId: number; TotalBalance: number }>;
  PastDueEmailSentDate: string | null;
}
