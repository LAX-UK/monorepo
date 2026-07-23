import { buildListHref, firstString } from "@/lib/admin/admin-list-params";
import type { CatalogActiveFilterChip } from "@/lib/admin/catalog/types";
import type { PayoutStatus } from "@auction/types";
import { payoutStatuses } from "@auction/types";

type SearchParams = Record<string, string | string[] | undefined>;

export type PayoutsListFilters = {
  status?: PayoutStatus;
  legalEntityId?: string;
};

function isPayoutStatus(s: string | undefined): s is PayoutStatus {
  return s != null && (payoutStatuses as readonly string[]).includes(s);
}

function omitParamsHref(basePath: string, sp: SearchParams, omit: readonly string[]): string {
  const patch: Record<string, string | null> = { offset: "0" };
  for (const key of omit) {
    patch[key] = null;
  }
  return buildListHref(basePath, sp, patch);
}

export function parsePayoutsListFilters(sp: SearchParams): PayoutsListFilters {
  const statusRaw = firstString(sp.status);
  const status = isPayoutStatus(statusRaw) ? statusRaw : undefined;
  const legalEntityId = firstString(sp.legalEntityId)?.trim() || undefined;
  return {
    ...(status ? { status } : {}),
    ...(legalEntityId ? { legalEntityId } : {}),
  };
}

export function countPayoutsListActiveFilters(filters: PayoutsListFilters): number {
  let n = 0;
  if (filters.status) n += 1;
  if (filters.legalEntityId) n += 1;
  return n;
}

export function hasPayoutsListActiveFilters(filters: PayoutsListFilters): boolean {
  return countPayoutsListActiveFilters(filters) > 0;
}

export function buildPayoutsActiveFilterChips(
  basePath: string,
  sp: SearchParams,
  filters: PayoutsListFilters,
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];

  if (filters.legalEntityId) {
    const short =
      filters.legalEntityId.length > 12
        ? `${filters.legalEntityId.slice(0, 8)}…`
        : filters.legalEntityId;
    chips.push({
      id: "legalEntityId",
      label: `Entity: ${short}`,
      clearHref: omitParamsHref(basePath, sp, ["legalEntityId"]),
    });
  }

  return chips;
}
