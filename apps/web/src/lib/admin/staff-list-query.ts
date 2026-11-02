import { firstString } from "@/lib/admin/admin-list-params";
import type { CatalogActiveFilterChip } from "@/lib/admin/catalog/types";
import { type SearchParams, omitParamsHref } from "@/lib/admin/filter-chips/shared";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { GetAdminUserListParams } from "@/lib/data/http/admin-users.types";
import { searchChipLabel } from "@auction/staff-ui";
import type { UserStaffRole } from "@auction/types";
import { userStaffRoles } from "@auction/types";
import { adminUserListSortEnum } from "@auction/validators";
import type { z } from "zod";

export type StaffListSort = z.infer<typeof adminUserListSortEnum>;

export type StaffListFilters = {
  q?: string;
  staffRole?: string;
  /** The account-standing view tab; not a filter, so it is never counted or chipped. */
  accountStatus?: "active" | "suspended";
  /** How the list is ordered; not a filter, so it is never counted or chipped. */
  sort?: StaffListSort;
};

function isStaffRole(s: string | undefined): s is UserStaffRole {
  return s != null && (userStaffRoles as readonly string[]).includes(s);
}

function isStaffListSort(s: string | undefined): s is StaffListSort {
  return s != null && (adminUserListSortEnum.options as readonly string[]).includes(s);
}

export function parseStaffListFilters(sp: SearchParams): StaffListFilters {
  const q = firstString(sp.q)?.trim();
  const staffRoleRaw = firstString(sp.staffRole);
  const staffRole = isStaffRole(staffRoleRaw) ? staffRoleRaw : undefined;
  const statusRaw = firstString(sp.status);
  // `suspended=1` is the older spelling of the Suspended view.
  const accountStatus =
    statusRaw === "active" || statusRaw === "suspended"
      ? statusRaw
      : firstString(sp.suspended) === "1"
        ? "suspended"
        : undefined;
  const sortRaw = firstString(sp.sort);
  const sort = isStaffListSort(sortRaw) ? sortRaw : undefined;
  return {
    ...(q ? { q } : {}),
    ...(staffRole ? { staffRole } : {}),
    ...(accountStatus ? { accountStatus } : {}),
    ...(sort ? { sort } : {}),
  };
}

export function staffListFiltersToGetAdminUserListParams(
  filters: StaffListFilters,
  paging: { limit: number; offset: number },
): GetAdminUserListParams {
  return {
    limit: paging.limit,
    offset: paging.offset,
    role: "staff",
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.staffRole ? { staffRole: filters.staffRole } : {}),
    ...(filters.accountStatus ? { accountStatus: filters.accountStatus } : {}),
    ...(filters.sort ? { sort: filters.sort } : {}),
  };
}

export function countStaffListActiveFilters(filters: StaffListFilters): number {
  let n = 0;
  if (filters.q?.trim()) n += 1;
  if (filters.staffRole) n += 1;
  return n;
}

export function hasStaffListActiveFilters(filters: StaffListFilters): boolean {
  return countStaffListActiveFilters(filters) > 0;
}

export function buildStaffActiveFilterChips(
  basePath: string,
  sp: SearchParams,
  filters: StaffListFilters,
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];

  if (filters.q?.trim()) {
    chips.push({
      id: "q",
      label: searchChipLabel(filters.q),
      clearHref: omitParamsHref(basePath, sp, ["q"]),
    });
  }
  if (filters.staffRole) {
    chips.push({
      id: "staffRole",
      label: `Staff role: ${staffRoleLabel(filters.staffRole as UserStaffRole)}`,
      clearHref: omitParamsHref(basePath, sp, ["staffRole"]),
    });
  }
  return chips;
}
