import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { CatalogActiveFilterChip } from "@/lib/admin/catalog/types";
import { type SearchParams, omitParamsHref } from "@/lib/admin/filter-chips/shared";
import type { AdminListQueryBase } from "@/lib/admin/i-admin-list-controller";
import { searchChipLabel } from "@auction/staff-ui";
import { adminInvitationsListSortValues } from "@auction/validators";
import type { AdminInvitationsListSort } from "@auction/validators";

const INVITATION_STATUSES = ["pending", "accepted", "revoked", "expired"] as const;
export type InvitationListStatus = (typeof INVITATION_STATUSES)[number];

const STATUS_LABELS: Record<InvitationListStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
};

export type InvitationsListFilters = {
  q?: string;
  status?: InvitationListStatus;
};

export type InvitationListSort = AdminInvitationsListSort;
export const INVITATIONS_DEFAULT_SORT: InvitationListSort = "created_desc";

/** Full invitations list query (pagination + filters) — single parse for RSC and controllers. */
export type InvitationsListQuery = AdminListQueryBase & {
  status?: InvitationListStatus;
  /** Always set: the URL value, or the default order. */
  sort: InvitationListSort;
};

function isInvitationStatus(s: string | undefined): s is InvitationListStatus {
  return s != null && (INVITATION_STATUSES as readonly string[]).includes(s);
}

function parseInvitationsSort(raw: string | undefined): InvitationListSort {
  return adminInvitationsListSortValues.find((s) => s === raw) ?? INVITATIONS_DEFAULT_SORT;
}

/** Parse invitations list URL params once (pagination, search, status). */
export function parseInvitationsListQuery(sp: SearchParams): InvitationsListQuery {
  const base = parseListSearchParams(sp);
  const statusRaw = firstString(sp.status);
  const status = isInvitationStatus(statusRaw) ? statusRaw : undefined;
  return {
    ...base,
    limit: Math.min(200, base.limit),
    sort: parseInvitationsSort(base.sort),
    ...(status ? { status } : {}),
  };
}

export function invitationsListFiltersFromQuery(
  query: InvitationsListQuery,
): InvitationsListFilters {
  return {
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
}

/** @deprecated Prefer parseInvitationsListQuery + invitationsListFiltersFromQuery */
export function parseInvitationsListFilters(sp: SearchParams): InvitationsListFilters {
  return invitationsListFiltersFromQuery(parseInvitationsListQuery(sp));
}

export function countInvitationsListActiveFilters(filters: InvitationsListFilters): number {
  let n = 0;
  if (filters.q?.trim()) n += 1;
  if (filters.status) n += 1;
  return n;
}

export function hasInvitationsListActiveFilters(filters: InvitationsListFilters): boolean {
  return countInvitationsListActiveFilters(filters) > 0;
}

export function buildInvitationsActiveFilterChips(
  basePath: string,
  sp: SearchParams,
  filters: InvitationsListFilters,
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];

  if (filters.q?.trim()) {
    chips.push({
      id: "q",
      label: searchChipLabel(filters.q),
      clearHref: omitParamsHref(basePath, sp, ["q"]),
    });
  }
  if (filters.status) {
    chips.push({
      id: "status",
      label: `Status: ${STATUS_LABELS[filters.status]}`,
      clearHref: omitParamsHref(basePath, sp, ["status"]),
    });
  }

  return chips;
}

export const invitationStatusFilterOptions = INVITATION_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));
