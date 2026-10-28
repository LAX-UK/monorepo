import { buildListHref } from "@/lib/admin/admin-list-params";
import { defineListSort } from "@/lib/admin/define-list-sort";
import {
  STAFF_ROLE_ENDING_SOON_DAYS,
  type StaffRoleChipView,
  staffRoleChip,
  staffRoleLastDay,
} from "@/lib/admin/people/staff-roles.vm";
import type { StaffAccessReviewRow } from "@/lib/data/http/staff-roles.server";
import { formatStaffDate } from "@auction/staff-ui";
import {
  type UserStaffRole,
  bidStaffRoleLabel,
  normalizeUserStaffRole,
  staffRoleAssignmentEndsWithin,
} from "@auction/types";

export const STAFF_ACCESS_REVIEW_PATH = "/admin/staff/access";

export type AccessReviewSearch = Record<string, string | string[] | undefined>;

export type AccessReviewView = "all" | "ending";

export type AccessReviewFilters = {
  view: AccessReviewView;
  role: UserStaffRole | null;
  q: string;
};

const first = (value: string | string[] | undefined) =>
  (typeof value === "string" ? value : value?.[0])?.trim() ?? "";

/** The review's filters from the URL: the view, one role, and a name or email search. */
export function parseAccessReviewFilters(search: AccessReviewSearch): AccessReviewFilters {
  return {
    view: first(search.view) === "ending" ? "ending" : "all",
    role: normalizeUserStaffRole(first(search.role)) ?? null,
    q: first(search.q),
  };
}

export function accessReviewHref(
  search: AccessReviewSearch,
  patch: Record<string, string | null | undefined>,
): string {
  return buildListHref(STAFF_ACCESS_REVIEW_PATH, search, patch);
}

function endsSoon(row: StaffAccessReviewRow, now: Date): boolean {
  return row.roles.some(
    (role) =>
      role.endsAt !== null &&
      staffRoleAssignmentEndsWithin(
        { endsAt: new Date(role.endsAt) },
        now,
        STAFF_ROLE_ENDING_SOON_DAYS,
      ),
  );
}

function matchesSearch(row: StaffAccessReviewRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.email.toLowerCase().includes(needle) || (row.name ?? "").toLowerCase().includes(needle)
  );
}

/** People who hold `role` (in force or starting later), match the search, and fit the view. */
export function filterAccessReview(
  rows: readonly StaffAccessReviewRow[],
  filters: AccessReviewFilters,
  now: Date,
): StaffAccessReviewRow[] {
  return rows.filter(
    (row) =>
      (filters.role === null || row.roles.some((held) => held.role === filters.role)) &&
      matchesSearch(row, filters.q) &&
      (filters.view === "all" || endsSoon(row, now)),
  );
}

/** How many people each view holds under the role filter and search. */
export function accessReviewCounts(
  rows: readonly StaffAccessReviewRow[],
  filters: AccessReviewFilters,
  now: Date,
): Record<AccessReviewView, number> {
  return {
    all: filterAccessReview(rows, { ...filters, view: "all" }, now).length,
    ending: filterAccessReview(rows, { ...filters, view: "ending" }, now).length,
  };
}

/** One staff member as the review shows them. */
export type AccessReviewRowView = {
  id: string;
  name: string;
  email: string;
  suspended: boolean;
  roles: StaffRoleChipView[];
  /** The soonest end among their roles, ISO; null when none ends. */
  nextEnd: string | null;
  lastSignInAt: string | null;
  /** Their staff record, for viewers who may open it. */
  href: string | null;
};

export function toAccessReviewRows(
  rows: readonly StaffAccessReviewRow[],
  now: Date,
  recordHref: ((userId: string) => string) | null,
): AccessReviewRowView[] {
  return rows.map((row) => {
    const ends = row.roles.flatMap((role) => (role.endsAt ? [role.endsAt] : [])).sort();
    return {
      id: row.userId,
      name: row.name?.trim() || row.email,
      email: row.email,
      suspended: row.suspended,
      roles: row.roles.map((role) => staffRoleChip(role, now)),
      nextEnd: ends[0] ?? null,
      lastSignInAt: row.lastSignInAt,
      href: recordHref ? recordHref(row.userId) : null,
    };
  });
}

/** Name A to Z by default; also by last sign-in, and by the soonest end date. */
export const accessReviewSort = defineListSort(
  {
    name: { asc: "name_asc", desc: "name_desc" },
    nextEnd: { asc: "ends_asc", desc: "ends_desc" },
    lastSignIn: { asc: "signin_asc", desc: "signin_desc" },
  },
  "name_asc",
);

const SORT_VALUE: Record<string, (row: AccessReviewRowView) => string> = {
  name: (row) => row.name.toLowerCase(),
  // Rows without an end or a sign-in sort after every dated row, whichever the direction.
  nextEnd: (row) => row.nextEnd ?? "",
  lastSignIn: (row) => row.lastSignInAt ?? "",
};

export function sortAccessReview(
  rows: readonly AccessReviewRowView[],
  sortKey: string | null | undefined,
): AccessReviewRowView[] {
  const { columnId, direction } = accessReviewSort.state(sortKey);
  const value = SORT_VALUE[columnId] ?? SORT_VALUE.name;
  const dir = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = value?.(a) ?? "";
    const bv = value?.(b) ?? "";
    if (av === bv) return a.name.localeCompare(b.name);
    if (av === "") return 1;
    if (bv === "") return -1;
    return av < bv ? -dir : dir;
  });
}

/** One CSV row per role held, so a reviewer can sort and filter the file by role. */
export function accessReviewCsvRows(rows: readonly StaffAccessReviewRow[]) {
  return rows.flatMap((row) => {
    const base = {
      name: row.name?.trim() || row.email,
      email: row.email,
      account: row.suspended ? "Suspended" : "Active",
      lastSignIn: row.lastSignInAt ? new Date(row.lastSignInAt).toISOString() : "",
    };
    if (row.roles.length === 0) return [{ ...base, role: "", since: "", lastDay: "" }];
    return row.roles.map((role) => ({
      ...base,
      role: bidStaffRoleLabel(role.role),
      since: formatStaffDate(role.startsAt),
      lastDay: role.endsAt ? staffRoleLastDay(role.endsAt) : "",
    }));
  });
}

export const ACCESS_REVIEW_CSV_COLUMNS = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "account", header: "Account" },
  { key: "role", header: "Role" },
  { key: "since", header: "Since" },
  { key: "lastDay", header: "Last day" },
  { key: "lastSignIn", header: "Last sign-in" },
] as const;
