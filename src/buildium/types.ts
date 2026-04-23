/**
 * Hand-rolled types for the slice of the Buildium v1 API this dashboard uses.
 * Fields mirror the live API payloads observed during bring-up — anything we
 * don't consume is either omitted or left loosely typed.
 */

export type TaskStatus = 'New' | 'InProgress' | 'Completed' | 'Deferred' | 'Closed';
export type TaskPriority = 'Low' | 'Normal' | 'High';
export type TaskType =
  | 'ResidentRequest'
  | 'ContactRequest'
  | 'RentalOwnerRequest'
  | 'Todo'
  | string;

export const ACTIVE_STATUSES: TaskStatus[] = ['New', 'InProgress', 'Deferred'];
export const COMPLETED_STATUSES: TaskStatus[] = ['Completed', 'Closed'];

export interface TaskCategoryRef {
  Id: number;
  Name: string;
  Href?: string;
  SubCategory?: { Id: number; Name: string } | null;
}

export interface TaskCategory {
  Id: number;
  Name: string;
  IsSystemCategory: boolean;
  SubCategories: Array<{ Id: number; Name: string }>;
}

export interface PropertyRef {
  Id: number;
  Type: string;
  Href?: string;
}

export interface RequestedBy {
  Type: string;
  Id: number;
  FirstName?: string | null;
  LastName?: string | null;
  IsCompany?: boolean;
  Href?: string;
}

export interface BuildiumTask {
  Id: number;
  TaskType: TaskType;
  Category: TaskCategoryRef | null;
  Title: string;
  Description: string | null;
  Property: PropertyRef | null;
  UnitId: number | null;
  UnitAgreement: { Id: number; Type: string; Href?: string } | null;
  RequestedByUserEntity: RequestedBy | null;
  AssignedToUserId: number;
  TaskStatus: TaskStatus;
  Priority: TaskPriority;
  DueDate: string | null;
  CreatedDateTime: string;
  LastUpdatedDateTime: string;
}

export interface BuildiumUser {
  Id: number;
  UserTypes: string[];
  IsActive: boolean;
  LastLogin: string | null;
  FirstName: string | null;
  LastName: string | null;
  CompanyName: string | null;
  Email: string;
  AlternateEmail: string | null;
  PhoneNumbers: Array<{ Number: string; Type: string }>;
  UserRole: { Id: number; Name: string; Description: string; NumberOfUsers?: number } | null;
  IsCompany: boolean;
}

export interface BuildiumTaskHistoryEntry {
  Id: number;
  Priority: TaskPriority;
  TaskStatus: TaskStatus;
  AssignedToUserId: number;
  DueDate: string | null;
  Message: string | null;
  SharedWith: string[];
  FileIds: number[];
  /** Note the typo in the actual Buildium response ("TIme"). We accept both. */
  CreatedDateTIme?: string;
  CreatedDateTime?: string;
  CreatedByUser: { Id: number; FirstName: string; LastName: string; UserType: string } | null;
  LastUpdatedDateTime: string | null;
  LastUpdatedByUser: { Id: number; FirstName: string; LastName: string; UserType: string } | null;
}

export interface BuildiumResponse<T> {
  items: T[] | T;
  totalCount: number;
}
