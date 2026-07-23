import { buildListHref, firstString } from "@/lib/admin/admin-list-params";
import type { CatalogActiveFilterChip } from "@/lib/admin/catalog/types";
import { staffRoleLabel } from "@/lib/admin/staff-role-presenter";
import type { GetAdminUserListParams } from "@/lib/data/http/admin-users.types";
import type { UserStaffRole } from "@auction/types";
import { userStaffRoles } from "@auction/types";

type SearchParams = Record<string, string | string[] | undefined>;

export type StaffListFilters = {
  q?: string;
  staffRole?: string;
  suspendedOnly?: boolean;
};

function isStaffRole(s: string | undefined): s is UserStaffRole {
  return s != null && (userStaffRoles as readonly string[]).includes(s);
}

function omitParamsHref(basePath: string, sp: SearchParams, omit: readonly string[]): string {
  const patch: Record<string, string | null> = { offset: "0" };
  for (const key of omit) {
    patch[key] = null;
  }
  return buildListHref(basePath, sp, patch);
}

export function parseStaffListFilters(sp: SearchParams): StaffListFilters {
  const q = firstString(sp.q)?.trim();
  const staffRoleRaw = firstString(sp.staffRole);
  const staffRole = isStaffRole(staffRoleRaw) ? staffRoleRaw : undefined;
  const suspendedOnly = firstString(sp.suspended) === "1";
  return {
    ...(q ? { q } : {}),
    ...(staffRole ? { staffRole } : {}),
    ...(suspendedOnly ? { suspendedOnly: true } : {}),
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
    ...(filters.suspendedOnly ? { suspendedOnly: true } : {}),
  };
}

export function countStaffListActiveFilters(filters: StaffListFilters): number {
  let n = 0;
  if (filters.q?.trim()) n += 1;
  if (filters.staffRole) n += 1;
  if (filters.suspendedOnly) n += 1;
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
      label: `Search: ${filters.q.trim()}`,
      clearHref: omitParamsHref(basePath, sp, ["q"]),
    });
  }
  if (filters.staffRole) {
    chips.push({
      id: "staffRole",
      label: `Role: ${staffRoleLabel(filters.staffRole as UserStaffRole)}`,
      clearHref: omitParamsHref(basePath, sp, ["staffRole"]),
    });
  }
  if (filters.suspendedOnly) {
    chips.push({
      id: "suspended",
      label: "Suspended only",
      clearHref: omitParamsHref(basePath, sp, ["suspended"]),
    });
  }

  return chips;
}
