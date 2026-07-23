import { buildListHref, firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { CatalogActiveFilterChip } from "@/lib/admin/catalog/types";
import type { AdminListQueryBase } from "@/lib/admin/i-admin-list-controller";

type SearchParams = Record<string, string | string[] | undefined>;

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

/** Full invitations list query (pagination + filters) — single parse for RSC and controllers. */
export type InvitationsListQuery = AdminListQueryBase & {
  status?: InvitationListStatus;
};

function isInvitationStatus(s: string | undefined): s is InvitationListStatus {
  return s != null && (INVITATION_STATUSES as readonly string[]).includes(s);
}

function omitParamsHref(basePath: string, sp: SearchParams, omit: readonly string[]): string {
  const patch: Record<string, string | null> = { offset: "0" };
  for (const key of omit) {
    patch[key] = null;
  }
  return buildListHref(basePath, sp, patch);
}

/** Parse invitations list URL params once (pagination, search, status). */
export function parseInvitationsListQuery(sp: SearchParams): InvitationsListQuery {
  const base = parseListSearchParams(sp);
  const statusRaw = firstString(sp.status);
  const status = isInvitationStatus(statusRaw) ? statusRaw : undefined;
  return {
    ...base,
    limit: Math.min(200, base.limit),
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
      label: `Search: ${filters.q.trim()}`,
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
