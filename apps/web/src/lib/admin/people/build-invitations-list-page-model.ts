import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import {
  buildInvitationsActiveFilterChips,
  countInvitationsListActiveFilters,
  hasInvitationsListActiveFilters,
  invitationsListFiltersFromQuery,
  parseInvitationsListQuery,
} from "@/lib/admin/invitations-list-query";

export const INVITATIONS_LIST_PATH = "/admin/invitations";

export type InvitationsListSearchParams = Record<string, string | string[] | undefined> & {
  error?: string;
  q?: string;
  status?: string;
  limit?: string;
  offset?: string;
  invitation?: string;
};

export function buildInvitationsListPageModel(sp: InvitationsListSearchParams) {
  const query = parseInvitationsListQuery(sp);
  const listFilters = invitationsListFiltersFromQuery(query);
  const selectedInvitationId =
    (typeof sp.invitation === "string" ? sp.invitation : sp.invitation?.[0])?.trim() || undefined;
  const listQueryParams = {
    offset: query.offset,
    limit: query.limit,
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { q: query.q } : {}),
  };

  return {
    basePath: INVITATIONS_LIST_PATH,
    query,
    listQueryParams,
    listFilters,
    selectedInvitationId,
    listReturnTarget: buildAdminListReturnTarget(INVITATIONS_LIST_PATH, sp),
    hasFilters: hasInvitationsListActiveFilters(listFilters),
    activeFilterCount: countInvitationsListActiveFilters(listFilters),
    activeFilterChips: buildInvitationsActiveFilterChips(INVITATIONS_LIST_PATH, sp, listFilters),
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(INVITATIONS_LIST_PATH, sp, patch),
    buildDrawerHref: (invitationId: string | null) =>
      buildListHref(
        INVITATIONS_LIST_PATH,
        sp,
        invitationId ? { invitation: invitationId } : { invitation: "" },
      ),
  };
}

export type InvitationsListPageModel = ReturnType<typeof buildInvitationsListPageModel>;
