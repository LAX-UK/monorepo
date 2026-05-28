import { buildActiveFilterDescriptors, hasActiveFilters } from "../filter-active";
import { buildFilterHref } from "../filter-params";
import type { ActiveFilterDescriptor, FilterParamsRecord, ListPageFilterConfig } from "../types";

export const BIDS_BASE_PATH = "/dashboard/bids";

export type BidTab = "active" | "won" | "lost";

export type BidsFilters = {
  tab: BidTab;
  q: string;
};

export const BIDS_FILTER_DEFAULTS: Record<string, string | undefined> = {
  tab: "active",
  q: undefined,
};

export const BIDS_FILTER_CONFIG: ListPageFilterConfig = {
  basePath: BIDS_BASE_PATH,
  defaults: BIDS_FILTER_DEFAULTS,
  filters: [
    {
      kind: "search",
      param: "q",
      label: "Filter by lot title",
      placeholder: "e.g. oil on canvas",
    },
  ],
};

export function parseBidTab(raw: string | null | undefined): BidTab {
  if (raw === "won" || raw === "lost") return raw;
  return "active";
}

export function parseBidsParams(raw: { tab?: string; q?: string }): BidsFilters {
  return {
    tab: parseBidTab(raw.tab),
    q: (raw.q ?? "").trim(),
  };
}

export function bidsFiltersToParams(filters: BidsFilters): FilterParamsRecord {
  return {
    ...(filters.tab !== "active" ? { tab: filters.tab } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };
}

export function buildBidsHref(
  current: BidsFilters,
  patch: Partial<{ tab: BidTab; q: string | null }>,
): string {
  const next: BidsFilters = {
    tab: patch.tab ?? current.tab,
    q: patch.q === undefined ? current.q : (patch.q ?? ""),
  };
  return buildFilterHref(BIDS_BASE_PATH, bidsFiltersToParams(next), {
    omitDefaults: BIDS_FILTER_DEFAULTS,
  });
}

export function buildBidsTabHref(tab: BidTab, q: string): string {
  return buildBidsHref({ tab, q }, {});
}

export function hasBidsActiveFilters(filters: BidsFilters): boolean {
  return hasActiveFilters(bidsFiltersToParams(filters), BIDS_FILTER_DEFAULTS, ["tab", "q"]);
}

export function getBidsActiveFilters(filters: BidsFilters): ActiveFilterDescriptor[] {
  return buildActiveFilterDescriptors(
    {
      basePath: BIDS_BASE_PATH,
      params: bidsFiltersToParams(filters),
      defaults: BIDS_FILTER_DEFAULTS,
      omitDefaults: BIDS_FILTER_DEFAULTS,
    },
    [
      {
        param: "q",
        isActive: () => Boolean(filters.q.trim()),
        label: () => `Search: ${filters.q}`,
        clearPatch: () => ({ q: undefined }),
      },
    ],
  );
}
