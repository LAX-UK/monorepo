import {
  PAYMENTS_STATUS_FILTER_OPTIONS,
  type PaymentsStatusFilter,
  parsePaymentsStatusFilter,
} from "@/app/dashboard/payments/payments-status-filter";
import type { PaymentsSort } from "@/lib/data/view-models/dashboard-payments.vm";
import { buildActiveFilterDescriptors, hasActiveFilters } from "../filter-active";
import { buildFilterHref } from "../filter-params";
import type { ActiveFilterDescriptor, FilterParamsRecord, ListPageFilterConfig } from "../types";

export const PAYMENTS_BASE_PATH = "/dashboard/payments";

export type PaymentsFilters = {
  status: PaymentsStatusFilter;
  q: string;
  sort: PaymentsSort;
  year: number | null;
};

export const PAYMENTS_SORT_OPTIONS: readonly { value: PaymentsSort; label: string }[] = [
  { value: "date-desc", label: "Newest" },
  { value: "date-asc", label: "Oldest" },
  { value: "amount-desc", label: "Highest first" },
  { value: "amount-asc", label: "Lowest first" },
] as const;

export const PAYMENTS_FILTER_DEFAULTS: Record<string, string | undefined> = {
  status: "all",
  q: undefined,
  sort: "date-desc",
  year: undefined,
};

export const PAYMENTS_FILTER_CONFIG: ListPageFilterConfig = {
  basePath: PAYMENTS_BASE_PATH,
  defaults: PAYMENTS_FILTER_DEFAULTS,
  filters: [
    {
      kind: "search",
      param: "q",
      label: "Search payments",
      placeholder: "Filter by lot title…",
    },
    {
      kind: "chips",
      param: "status",
      label: "Payment status",
      options: PAYMENTS_STATUS_FILTER_OPTIONS.map((o) => ({ id: o.value, label: o.label })),
      placement: "primary",
    },
    {
      kind: "select",
      param: "sort",
      label: "Sort",
      options: PAYMENTS_SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    },
    {
      kind: "chips",
      param: "year",
      label: "Year",
      options: [],
      placement: "sheet",
    },
  ],
};

const SORT_VALUES = new Set(PAYMENTS_SORT_OPTIONS.map((o) => o.value));

export function parsePaymentsParams(raw: {
  status?: string;
  q?: string;
  sort?: string;
  year?: string;
}): PaymentsFilters {
  const status = parsePaymentsStatusFilter(raw.status);
  const sort = SORT_VALUES.has(raw.sort as PaymentsSort) ? (raw.sort as PaymentsSort) : "date-desc";
  const yearRaw = raw.year;
  let year: number | null = null;
  if (yearRaw && /^\d{4}$/.test(yearRaw)) {
    year = Number.parseInt(yearRaw, 10);
  }
  return {
    status,
    q: (raw.q ?? "").trim(),
    sort,
    year,
  };
}

export function paymentsFiltersToParams(filters: PaymentsFilters): FilterParamsRecord {
  return {
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.sort !== "date-desc" ? { sort: filters.sort } : {}),
    ...(filters.year != null ? { year: String(filters.year) } : {}),
  };
}

export function buildPaymentsHref(
  current: PaymentsFilters,
  patch: Partial<{
    status: PaymentsStatusFilter;
    q: string | null;
    sort: PaymentsSort;
    year: number | null;
  }>,
): string {
  const next: PaymentsFilters = {
    status: patch.status ?? current.status,
    q: patch.q === undefined ? current.q : (patch.q ?? ""),
    sort: patch.sort ?? current.sort,
    year: patch.year === undefined ? current.year : patch.year,
  };
  return buildFilterHref(PAYMENTS_BASE_PATH, paymentsFiltersToParams(next), {
    omitDefaults: PAYMENTS_FILTER_DEFAULTS,
  });
}

export function hasPaymentsActiveFilters(filters: PaymentsFilters): boolean {
  return hasActiveFilters(paymentsFiltersToParams(filters), PAYMENTS_FILTER_DEFAULTS, [
    "status",
    "q",
    "sort",
    "year",
  ]);
}

export function getPaymentsActiveFilters(filters: PaymentsFilters): ActiveFilterDescriptor[] {
  const statusLabel =
    PAYMENTS_STATUS_FILTER_OPTIONS.find((o) => o.value === filters.status)?.label ?? filters.status;
  const sortLabel =
    PAYMENTS_SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? filters.sort;

  return buildActiveFilterDescriptors(
    {
      basePath: PAYMENTS_BASE_PATH,
      params: paymentsFiltersToParams(filters),
      defaults: PAYMENTS_FILTER_DEFAULTS,
      omitDefaults: PAYMENTS_FILTER_DEFAULTS,
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
        isActive: () => filters.status !== "all",
        label: () => statusLabel,
        clearPatch: () => ({ status: undefined }),
      },
      {
        param: "sort",
        isActive: () => filters.sort !== "date-desc",
        label: () => sortLabel,
        clearPatch: () => ({ sort: undefined }),
      },
      {
        param: "year",
        isActive: () => filters.year != null,
        label: () => String(filters.year),
        clearPatch: () => ({ year: undefined }),
      },
    ],
  );
}

/** Desktop filter sheet badge — status and year when year lives in the sheet. */
export function countPaymentsSheetFilters(filters: PaymentsFilters): number {
  let count = 0;
  if (filters.status !== "all") count += 1;
  if (filters.year != null) count += 1;
  return count;
}

/** Desktop filter sheet badge when only status is drawer-only (year chips stay inline). */
export function countPaymentsStatusSheetFilters(filters: PaymentsFilters): number {
  return filters.status !== "all" ? 1 : 0;
}

/** Active dimensions shown in the mobile filter sheet (status, year, sort). */
export function countPaymentsMobileSheetFilters(filters: PaymentsFilters): number {
  let count = 0;
  if (filters.status !== "all") count += 1;
  if (filters.year != null) count += 1;
  if (filters.sort !== "date-desc") count += 1;
  return count;
}

export const PAYMENTS_INLINE_YEAR_THRESHOLD = 8;
