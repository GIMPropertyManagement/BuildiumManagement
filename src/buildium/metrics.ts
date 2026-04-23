import {
  differenceInCalendarDays,
  differenceInMinutes,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns';
import type {
  BuildiumTask,
  BuildiumUser,
  TaskPriority,
  TaskStatus,
} from './types';
// ACTIVE_STATUSES / COMPLETED_STATUSES are applied at the fetch layer —
// here we trust the caller to pass pre-filtered buckets.

/**
 * Shape aggregated per property manager / staff assignee. Drives the
 * leaderboard, wall of shame, and scorecards.
 */
export interface StaffMetrics {
  id: number;
  staff: BuildiumUser | null;
  displayName: string;
  role: string;
  isActiveStaff: boolean;
  open: BuildiumTask[];
  overdue: BuildiumTask[];
  stale: BuildiumTask[];
  highPriorityOpen: BuildiumTask[];
  unscheduled: BuildiumTask[];
  newStatus: BuildiumTask[];
  inProgress: BuildiumTask[];
  deferred: BuildiumTask[];
  closedLast30: BuildiumTask[];
  closedLast7: BuildiumTask[];
  avgDaysToClose: number | null;
  medianDaysToClose: number | null;
  oldestOpenDays: number;
  oldestOpen: BuildiumTask | null;
  longestSilenceDays: number;
  longestSilenceTask: BuildiumTask | null;
  /**
   * Composite performance score. Higher is better. Designed to reward
   * throughput and punish neglect — throwing tasks into "Deferred" doesn't
   * count as work done.
   */
  score: number;
}

export interface TeamMetrics {
  totalOpen: number;
  totalOverdue: number;
  totalStale: number;
  totalUnassigned: number;
  totalHighPriorityOpen: number;
  closedLast7: number;
  closedLast30: number;
  createdLast7: number;
  createdLast30: number;
  avgDaysToClose: number | null;
  medianDaysToClose: number | null;
  statusBreakdown: Record<TaskStatus, number>;
  priorityBreakdown: Record<TaskPriority, number>;
  categoryBreakdown: Array<{ name: string; open: number; total: number }>;
  typeBreakdown: Record<string, number>;
  closedPerDay: Array<{ date: string; closed: number; created: number }>;
  oldestOpenDays: number;
}

export interface DashboardData {
  byStaff: StaffMetrics[];
  team: TeamMetrics;
  rawActive: BuildiumTask[];
  rawRecentClosed: BuildiumTask[];
  lastUpdated: Date;
}

const UNASSIGNED_ID = 0;

function safeParse(date: string | null | undefined): Date | null {
  if (!date) return null;
  try {
    const d = parseISO(date);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function staffDisplayName(u: BuildiumUser | null, id: number): string {
  if (!u) return id === UNASSIGNED_ID ? 'Unassigned' : `User ${id}`;
  const first = u.FirstName?.trim();
  const last = u.LastName?.trim();
  if (first || last) return `${first ?? ''} ${last ?? ''}`.trim();
  return u.CompanyName?.trim() || u.Email || `User ${u.Id}`;
}

export function computeMetrics(
  activeTasks: BuildiumTask[],
  recentClosedTasks: BuildiumTask[],
  users: BuildiumUser[],
  now = new Date(),
): DashboardData {
  const today = startOfDay(now);
  const sevenDaysAgo = subDays(today, 7);
  const thirtyDaysAgo = subDays(today, 30);

  const userById = new Map(users.map((u) => [u.Id, u]));

  const staffBucket = new Map<number, StaffMetrics>();
  const ensureBucket = (id: number): StaffMetrics => {
    let bucket = staffBucket.get(id);
    if (bucket) return bucket;
    const staff = userById.get(id) ?? null;
    bucket = {
      id,
      staff,
      displayName: staffDisplayName(staff, id),
      role: staff?.UserRole?.Name ?? (id === UNASSIGNED_ID ? '—' : 'Unknown'),
      isActiveStaff: staff?.IsActive !== false && id !== UNASSIGNED_ID,
      open: [],
      overdue: [],
      stale: [],
      highPriorityOpen: [],
      unscheduled: [],
      newStatus: [],
      inProgress: [],
      deferred: [],
      closedLast30: [],
      closedLast7: [],
      avgDaysToClose: null,
      medianDaysToClose: null,
      oldestOpenDays: 0,
      oldestOpen: null,
      longestSilenceDays: 0,
      longestSilenceTask: null,
      score: 0,
    };
    staffBucket.set(id, bucket);
    return bucket;
  };

  const statusBreakdown: Record<TaskStatus, number> = {
    New: 0,
    InProgress: 0,
    Deferred: 0,
    Completed: 0,
    Closed: 0,
  };
  const priorityBreakdown: Record<TaskPriority, number> = { Low: 0, Normal: 0, High: 0 };
  const typeBreakdown: Record<string, number> = {};
  const openByCategory = new Map<string, number>();

  for (const t of activeTasks) {
    const id = t.AssignedToUserId || UNASSIGNED_ID;
    const bucket = ensureBucket(id);
    bucket.open.push(t);
    statusBreakdown[t.TaskStatus] = (statusBreakdown[t.TaskStatus] ?? 0) + 1;
    priorityBreakdown[t.Priority] = (priorityBreakdown[t.Priority] ?? 0) + 1;
    typeBreakdown[t.TaskType] = (typeBreakdown[t.TaskType] ?? 0) + 1;

    const categoryName = t.Category?.Name ?? 'Uncategorized';
    openByCategory.set(categoryName, (openByCategory.get(categoryName) ?? 0) + 1);

    if (t.TaskStatus === 'New') bucket.newStatus.push(t);
    if (t.TaskStatus === 'InProgress') bucket.inProgress.push(t);
    if (t.TaskStatus === 'Deferred') bucket.deferred.push(t);
    if (t.Priority === 'High') bucket.highPriorityOpen.push(t);
    if (!t.DueDate) bucket.unscheduled.push(t);

    const due = safeParse(t.DueDate);
    if (due && due < today) bucket.overdue.push(t);

    const lastUpdated = safeParse(t.LastUpdatedDateTime);
    if (lastUpdated && lastUpdated < sevenDaysAgo) bucket.stale.push(t);

    const created = safeParse(t.CreatedDateTime);
    if (created) {
      const age = differenceInCalendarDays(now, created);
      if (age > bucket.oldestOpenDays) {
        bucket.oldestOpenDays = age;
        bucket.oldestOpen = t;
      }
    }

    const silence = lastUpdated ? differenceInCalendarDays(now, lastUpdated) : 0;
    if (silence > bucket.longestSilenceDays) {
      bucket.longestSilenceDays = silence;
      bucket.longestSilenceTask = t;
    }
  }

  for (const t of recentClosedTasks) {
    const id = t.AssignedToUserId || UNASSIGNED_ID;
    const bucket = ensureBucket(id);
    const lastUpdated = safeParse(t.LastUpdatedDateTime);
    if (!lastUpdated) continue;
    if (lastUpdated >= thirtyDaysAgo) bucket.closedLast30.push(t);
    if (lastUpdated >= sevenDaysAgo) bucket.closedLast7.push(t);
    statusBreakdown[t.TaskStatus] = (statusBreakdown[t.TaskStatus] ?? 0) + 1;
    typeBreakdown[t.TaskType] = (typeBreakdown[t.TaskType] ?? 0) + 1;
  }

  for (const bucket of staffBucket.values()) {
    const durations = bucket.closedLast30
      .map((t) => {
        const created = safeParse(t.CreatedDateTime);
        const closed = safeParse(t.LastUpdatedDateTime);
        if (!created || !closed) return null;
        const mins = differenceInMinutes(closed, created);
        return mins > 0 ? mins / (60 * 24) : 0;
      })
      .filter((n): n is number => n !== null);
    bucket.avgDaysToClose = avg(durations);
    bucket.medianDaysToClose = median(durations);

    bucket.score = Math.round(
      bucket.closedLast30.length * 10 +
        bucket.closedLast7.length * 5 -
        bucket.overdue.length * 15 -
        bucket.stale.length * 5 -
        bucket.highPriorityOpen.length * 3 -
        Math.min(bucket.oldestOpenDays, 180) / 3,
    );
  }

  const closedPerDayMap = new Map<string, { closed: number; created: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = subDays(today, i);
    const key = d.toISOString().slice(0, 10);
    closedPerDayMap.set(key, { closed: 0, created: 0 });
  }
  for (const t of recentClosedTasks) {
    const closed = safeParse(t.LastUpdatedDateTime);
    if (!closed) continue;
    const key = closed.toISOString().slice(0, 10);
    const bucket = closedPerDayMap.get(key);
    if (bucket) bucket.closed += 1;
  }
  for (const t of [...activeTasks, ...recentClosedTasks]) {
    const created = safeParse(t.CreatedDateTime);
    if (!created) continue;
    const key = created.toISOString().slice(0, 10);
    const bucket = closedPerDayMap.get(key);
    if (bucket) bucket.created += 1;
  }
  const closedPerDay = Array.from(closedPerDayMap.entries()).map(
    ([date, v]) => ({ date, ...v }),
  );

  const teamDurations = Array.from(staffBucket.values())
    .flatMap((b) =>
      b.closedLast30.map((t) => {
        const created = safeParse(t.CreatedDateTime);
        const closed = safeParse(t.LastUpdatedDateTime);
        if (!created || !closed) return null;
        const mins = differenceInMinutes(closed, created);
        return mins > 0 ? mins / (60 * 24) : 0;
      }),
    )
    .filter((n): n is number => n !== null);

  const categoryBreakdown: TeamMetrics['categoryBreakdown'] = Array.from(
    openByCategory.entries(),
  )
    .map(([name, open]) => ({ name, open, total: open }))
    .sort((a, b) => b.open - a.open);

  const createdLast7 = activeTasks
    .concat(recentClosedTasks)
    .filter((t) => {
      const created = safeParse(t.CreatedDateTime);
      return created ? created >= sevenDaysAgo : false;
    }).length;
  const createdLast30 = activeTasks
    .concat(recentClosedTasks)
    .filter((t) => {
      const created = safeParse(t.CreatedDateTime);
      return created ? created >= thirtyDaysAgo : false;
    }).length;

  const byStaff = Array.from(staffBucket.values()).sort((a, b) => b.score - a.score);

  const team: TeamMetrics = {
    totalOpen: activeTasks.length,
    totalOverdue: byStaff.reduce((s, b) => s + b.overdue.length, 0),
    totalStale: byStaff.reduce((s, b) => s + b.stale.length, 0),
    totalUnassigned: byStaff.find((b) => b.id === UNASSIGNED_ID)?.open.length ?? 0,
    totalHighPriorityOpen: byStaff.reduce((s, b) => s + b.highPriorityOpen.length, 0),
    closedLast7: byStaff.reduce((s, b) => s + b.closedLast7.length, 0),
    closedLast30: byStaff.reduce((s, b) => s + b.closedLast30.length, 0),
    createdLast7,
    createdLast30,
    avgDaysToClose: avg(teamDurations),
    medianDaysToClose: median(teamDurations),
    statusBreakdown,
    priorityBreakdown,
    categoryBreakdown,
    typeBreakdown,
    closedPerDay,
    oldestOpenDays: Math.max(0, ...byStaff.map((b) => b.oldestOpenDays)),
  };

  return {
    byStaff,
    team,
    rawActive: activeTasks,
    rawRecentClosed: recentClosedTasks,
    lastUpdated: now,
  };
}

export function linkAssigneeUsers(
  tasks: BuildiumTask[],
  users: BuildiumUser[],
): BuildiumUser[] {
  // The /v1/users endpoint's usertypes=Staff filter returns a superset of
  // assignees — but some assignees may not come back (e.g. deactivated). We
  // surface any extras we see in tasks so the UI can label them gracefully.
  const known = new Set(users.map((u) => u.Id));
  const extras = new Set<number>();
  for (const t of tasks) {
    if (t.AssignedToUserId && !known.has(t.AssignedToUserId)) {
      extras.add(t.AssignedToUserId);
    }
  }
  const placeholders: BuildiumUser[] = Array.from(extras).map((id) => ({
    Id: id,
    UserTypes: [],
    IsActive: false,
    LastLogin: null,
    FirstName: null,
    LastName: null,
    CompanyName: null,
    Email: '',
    AlternateEmail: null,
    PhoneNumbers: [],
    UserRole: null,
    IsCompany: false,
  }));
  return [...users, ...placeholders];
}

export function taskAgeDays(task: BuildiumTask, now = new Date()): number {
  const created = safeParse(task.CreatedDateTime);
  return created ? differenceInCalendarDays(now, created) : 0;
}

export function daysSinceUpdate(task: BuildiumTask, now = new Date()): number {
  const last = safeParse(task.LastUpdatedDateTime);
  return last ? differenceInCalendarDays(now, last) : 0;
}

export function daysOverdue(task: BuildiumTask, now = new Date()): number {
  const due = safeParse(task.DueDate);
  if (!due) return 0;
  return Math.max(0, differenceInCalendarDays(now, due));
}

/** Used by wall-of-shame sort. */
export function stalenessScore(task: BuildiumTask, now = new Date()): number {
  return daysSinceUpdate(task, now) + daysOverdue(task, now) * 2;
}

export function categoryLabel(t: BuildiumTask): string {
  if (!t.Category) return 'Uncategorized';
  return t.Category.SubCategory
    ? `${t.Category.Name} / ${t.Category.SubCategory.Name}`
    : t.Category.Name;
}

export function buildiumTaskUrl(taskId: number): string {
  return `https://gimpm.managebuilding.com/manager/app/tasks/${taskId}/task-summary?searchOption=all`;
}
