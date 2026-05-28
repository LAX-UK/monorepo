import { buildActiveFilterDescriptors, hasActiveFilters } from "../filter-active";
import { buildFilterHref } from "../filter-params";
import type { ActiveFilterDescriptor, FilterParamsRecord, ListPageFilterConfig } from "../types";

export const IN_SALE_BASE_PATH = "/dashboard/seller/in-sale";

export type InSaleStatusFilter = "live" | "scheduled" | "ended" | "all";

export type InSaleFilters = {
  status: InSaleStatusFilter;
  q: string;
};

export const IN_SALE_STATUS_OPTIONS: readonly { value: InSaleStatusFilter; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "ended", label: "Ended" },
  { value: "all", label: "All" },
] as const;

export const IN_SALE_FILTER_DEFAULTS: Record<string, string | undefined> = {
  status: "live",
  q: undefined,
};

export const IN_SALE_FILTER_CONFIG: ListPageFilterConfig = {
  basePath: IN_SALE_BASE_PATH,
  defaults: IN_SALE_FILTER_DEFAULTS,
  filters: [
    {
      kind: "search",
      param: "q",
      label: "Filter by lot or sale title",
      placeholder: "Search by lot or sale title",
    },
    {
      kind: "chips",
      param: "status",
      label: "Filter lots by status",
      options: IN_SALE_STATUS_OPTIONS.map((o) => ({ id: o.value, label: o.label })),
      placement: "primary",
    },
  ],
};

const STATUS_VALUES = new Set(IN_SALE_STATUS_OPTIONS.map((o) => o.value));

export function parseInSaleParams(raw: { status?: string; q?: string }): InSaleFilters {
  const status =
    raw.status && STATUS_VALUES.has(raw.status as InSaleStatusFilter)
      ? (raw.status as InSaleStatusFilter)
      : "live";
  return {
    status,
    q: (raw.q ?? "").trim().slice(0, 200),
  };
}

export function inSaleFiltersToParams(filters: InSaleFilters): FilterParamsRecord {
  return {
    ...(filters.status !== "live" ? { status: filters.status } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };
}

export function buildInSaleHref(
  current: InSaleFilters,
  patch: Partial<{ status: InSaleStatusFilter; q: string | null }>,
): string {
  const next: InSaleFilters = {
    status: patch.status ?? current.status,
    q: patch.q === undefined ? current.q : (patch.q ?? "").trim().slice(0, 200),
  };
  return buildFilterHref(IN_SALE_BASE_PATH, inSaleFiltersToParams(next), {
    omitDefaults: IN_SALE_FILTER_DEFAULTS,
  });
}

export function hasInSaleActiveFilters(filters: InSaleFilters): boolean {
  return hasActiveFilters(inSaleFiltersToParams(filters), IN_SALE_FILTER_DEFAULTS, ["status", "q"]);
}

export function countInSaleMobileSheetFilters(filters: InSaleFilters): number {
  return filters.status !== "live" ? 1 : 0;
}

export function getInSaleActiveFilters(filters: InSaleFilters): ActiveFilterDescriptor[] {
  const statusLabel =
    IN_SALE_STATUS_OPTIONS.find((o) => o.value === filters.status)?.label ?? filters.status;

  return buildActiveFilterDescriptors(
    {
      basePath: IN_SALE_BASE_PATH,
      params: inSaleFiltersToParams(filters),
      defaults: IN_SALE_FILTER_DEFAULTS,
      omitDefaults: IN_SALE_FILTER_DEFAULTS,
    },
    [
      {
        param: "q",
        isActive: () => Boolean(filters.q.trim()),
        label: () => `Search: ${filters.q}`,
        clearPatch: () => ({ q: undefined }),
      },
      {
        param: "status",
        isActive: () => filters.status !== "live",
        label: () => statusLabel,
        clearPatch: () => ({ status: undefined }),
      },
    ],
  );
}
