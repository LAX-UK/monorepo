import { buildListHref } from "@/lib/admin/admin-list-params";
import {
  buildPayoutsActiveFilterChips,
  countPayoutsListActiveFilters,
  hasPayoutsListActiveFilters,
  parsePayoutsListFilters,
} from "@/lib/admin/payouts-list-query";
import { payoutStatuses } from "@auction/types";

export type PayoutsListSearchParams = {
  error?: string;
  success?: string;
  status?: string;
  legalEntityId?: string;
  limit?: string;
  offset?: string;
  settlement?: string;
  period?: string;
  payout?: string;
};

const BASE_PATH = "/admin/payouts";
const filters = ["all", ...payoutStatuses] as const;

export function buildPayoutsListPageModel(sp: PayoutsListSearchParams) {
  const listFilters = parsePayoutsListFilters(sp);
  const limit = Math.min(99, Math.max(1, Number(sp.limit ?? 99) || 99));
  const offset = Math.max(0, Number(sp.offset ?? 0) || 0);
  const status = listFilters.status;
  const legalEntityId = listFilters.legalEntityId;
  const selectedPayoutId = sp.payout?.trim() || undefined;

  const listQueryParams = {
    limit,
    offset,
    ...(status ? { status } : {}),
    ...(legalEntityId ? { legalEntityId } : {}),
  };

  const statusChipSpecs = filters.map((filter) => ({
    id: filter,
    label: filter.replaceAll("_", " "),
    href: buildListHref(BASE_PATH, sp, {
      status: filter === "all" ? "" : filter,
      offset: 0,
    }),
    active: (filter === "all" && !status) || status === filter,
  }));

  return {
    basePath: BASE_PATH,
    query: { offset, limit, status, legalEntityId },
    listQueryParams,
    listFilters,
    selectedPayoutId,
    hasFilters: hasPayoutsListActiveFilters(listFilters),
    activeFilterCount: countPayoutsListActiveFilters(listFilters),
    activeFilterChips: buildPayoutsActiveFilterChips(BASE_PATH, sp, listFilters),
    statusChipSpecs,
    showSettlementReadiness: !status,
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(BASE_PATH, sp, patch),
    buildDrawerHref: (payoutId: string | null) =>
      buildListHref(BASE_PATH, sp, payoutId ? { payout: payoutId } : { payout: "" }),
  };
}

export type PayoutsListPageModel = ReturnType<typeof buildPayoutsListPageModel>;
