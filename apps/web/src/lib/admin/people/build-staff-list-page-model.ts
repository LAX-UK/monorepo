import { buildListHref, parseListSearchParams } from "@/lib/admin/admin-list-params";
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
};

export function buildStaffListPageModel(sp: StaffListSearchParams) {
  const base = parseListSearchParams(sp);
  const limit = Math.min(100, Math.max(1, base.limit));
  const offset = Math.max(0, base.offset);
  const listFilters = parseStaffListFilters(sp);
  const listQueryParams = staffListFiltersToGetAdminUserListParams(listFilters, { limit, offset });

  return {
    basePath: STAFF_LIST_PATH,
    query: { offset, limit, sort: listFilters.sort },
    listQueryParams,
    listFilters,
    hasFilters: hasStaffListActiveFilters(listFilters),
    activeFilterCount: countStaffListActiveFilters(listFilters),
    activeFilterChips: buildStaffActiveFilterChips(STAFF_LIST_PATH, sp, listFilters),
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(STAFF_LIST_PATH, sp, patch),
  };
}

export type StaffListPageModel = ReturnType<typeof buildStaffListPageModel>;
