import type { CatalogActiveFilterChip } from "@/components/admin/catalog/catalog-active-filters-row";
import { buildListHref, firstString } from "@/lib/admin/admin-list-params";

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

export function parseInvitationsListFilters(sp: SearchParams): InvitationsListFilters {
  const q = firstString(sp.q)?.trim();
  const statusRaw = firstString(sp.status);
  const status = isInvitationStatus(statusRaw) ? statusRaw : undefined;
  return {
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
  };
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
