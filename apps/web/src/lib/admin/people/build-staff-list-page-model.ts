import { buildListHref, parseListSearchParams } from "@/lib/admin/admin-list-params";
import { buildAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import {
  buildStaffActiveFilterChips,
  countStaffListActiveFilters,
  hasStaffListActiveFilters,
  parseStaffListFilters,
  staffListFiltersToGetAdminUserListParams,
} from "@/lib/admin/staff-list-query";

export const STAFF_LIST_PATH = "/admin/staff";

export type StaffListSearchParams = Record<string, string | string[] | undefined> & {
  error?: string;
  staff?: string;
};

export function buildStaffListPageModel(sp: StaffListSearchParams) {
  const base = parseListSearchParams(sp);
  const limit = Math.min(100, Math.max(1, base.limit));
  const offset = Math.max(0, base.offset);
  const listFilters = parseStaffListFilters(sp);
  const selectedStaffId =
    (typeof sp.staff === "string" ? sp.staff : sp.staff?.[0])?.trim() || undefined;
  const listQueryParams = staffListFiltersToGetAdminUserListParams(listFilters, { limit, offset });

  return {
    basePath: STAFF_LIST_PATH,
    query: { offset, limit },
    listQueryParams,
    listFilters,
    selectedStaffId,
    listReturnTarget: buildAdminListReturnTarget(STAFF_LIST_PATH, sp),
    hasFilters: hasStaffListActiveFilters(listFilters),
    activeFilterCount: countStaffListActiveFilters(listFilters),
    activeFilterChips: buildStaffActiveFilterChips(STAFF_LIST_PATH, sp, listFilters),
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(STAFF_LIST_PATH, sp, patch),
    buildDrawerHref: (staffId: string | null) =>
      buildListHref(STAFF_LIST_PATH, sp, staffId ? { staff: staffId } : { staff: "" }),
  };
}

export type StaffListPageModel = ReturnType<typeof buildStaffListPageModel>;
