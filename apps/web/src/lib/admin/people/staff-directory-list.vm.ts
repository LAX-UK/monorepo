import { buildListHref } from "@/lib/admin/admin-list-params";
import { defineListSort } from "@/lib/admin/define-list-sort";
import { STAFF_LIST_PATH } from "@/lib/admin/people/build-staff-list-page-model";
import { accountStanding } from "@/lib/admin/people/clients-staff-list.vm";
import { staffPlatformBadges } from "@/lib/admin/people/staff-access-presenter";
import { staffRoleFilterOptions, staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { AdminUserRow } from "@/lib/data/http/admin-users.types";
import type { StatusPresentation } from "@auction/staff-ui";
import type { LaxStaffAccessProduct, UserStaffRole } from "@auction/types";

export type StaffListSearch = Record<string, string | string[] | undefined>;

/** One staff member as the staff list shows them; plain data for the client component. */
export type StaffDirectoryRow = {
  id: string;
  name: string;
  email: string;
  account: StatusPresentation;
  staffRole: UserStaffRole | null;
  staffRoleLabel: string;
  /** "Bid · Finance", one per LAX tool they can use. */
  access: string[];
  /** On, Off, or null when the access service did not say. */
  twoFactor: boolean | null;
  lastSignInAt: string | null;
  joinedAt: string;
  suspended: boolean;
  href: string;
};

type AccessSummary = {
  platforms: readonly { product: LaxStaffAccessProduct; role: string }[];
  twoFactorEnabled: boolean | null;
  lastSignInAt: string | null;
};

export function toStaffDirectoryRows(
  rows: readonly AdminUserRow[],
  access: Record<string, AccessSummary>,
  returnTo: string,
): StaffDirectoryRow[] {
  return rows.map((row) => {
    const summary = access[row.id];
    const staffRole = (row.staffRole as UserStaffRole | null) ?? null;
    return {
      id: row.id,
      name: row.name?.trim() || row.email,
      email: row.email,
      account: accountStanding(row),
      staffRole,
      staffRoleLabel: staffRole ? staffRoleLabel(staffRole) : "No staff role",
      access: summary ? staffPlatformBadges(summary.platforms).map((badge) => badge.label) : [],
      twoFactor: summary?.twoFactorEnabled ?? row.twoFactorEnabled,
      lastSignInAt: summary?.lastSignInAt ?? null,
      joinedAt: row.createdAt,
      suspended: row.suspendedAt !== null,
      href: `${STAFF_LIST_PATH}/${row.id}?returnTo=${encodeURIComponent(returnTo)}`,
    };
  });
}

export function staffListHref(
  current: StaffListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  return buildListHref(STAFF_LIST_PATH, current, {
    offset: 0,
    staff: null,
    suspended: null,
    ...patch,
  });
}

/** The list with this person's panel open (`?staff=`), or closed for null. */
export function staffPanelHref(current: StaffListSearch, id: string | null): string {
  return buildListHref(STAFF_LIST_PATH, current, { staff: id });
}

export const STAFF_ROLE_FILTERS = staffRoleFilterOptions;

/** Newest first, unless the person sorts by name or oldest first. */
export const staffSort = defineListSort(
  {
    name: { asc: "name_asc", desc: "name_desc" },
    joined: { asc: "created_asc", desc: "created_desc" },
  },
  "created_desc",
);
