import { buildListHref, parseListSearchParams } from "@/lib/admin/admin-list-params";
import { buildAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import { buildUsersActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import {
  countUsersListActiveFilters,
  hasUsersListActiveFilters,
  parseUsersListFilters,
  usersListFiltersToExportFilters,
  usersListFiltersToGetAdminUserListParams,
} from "@/lib/admin/users-list-query";

export const CLIENTS_LIST_PATH = "/admin/clients";

export type ClientsListSearchParams = Record<string, string | string[] | undefined> & {
  error?: string;
  client?: string;
};

export function buildClientsListPageModel(sp: ClientsListSearchParams) {
  const base = parseListSearchParams(sp);
  const limit = Math.min(100, Math.max(1, base.limit));
  const offset = Math.max(0, base.offset);
  const listFilters = parseUsersListFilters({ ...sp, role: "client" });
  const selectedClientId =
    (typeof sp.client === "string" ? sp.client : sp.client?.[0])?.trim() || undefined;
  const listQueryParams = usersListFiltersToGetAdminUserListParams(listFilters, { limit, offset });

  return {
    basePath: CLIENTS_LIST_PATH,
    query: { offset, limit },
    listQueryParams: { ...listQueryParams, role: "client" as const },
    listFilters,
    selectedClientId,
    listReturnTarget: buildAdminListReturnTarget(CLIENTS_LIST_PATH, sp),
    hasFilters: hasUsersListActiveFilters(listFilters),
    activeFilterCount: countUsersListActiveFilters(listFilters),
    activeFilterChips: buildUsersActiveFilterChips(CLIENTS_LIST_PATH, sp, listFilters),
    exportFilters: {
      role: "client" as const,
      ...usersListFiltersToExportFilters(listFilters),
    },
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(CLIENTS_LIST_PATH, sp, patch),
    buildDrawerHref: (clientId: string | null) =>
      buildListHref(CLIENTS_LIST_PATH, sp, clientId ? { client: clientId } : { client: "" }),
  };
}

export type ClientsListPageModel = ReturnType<typeof buildClientsListPageModel>;
