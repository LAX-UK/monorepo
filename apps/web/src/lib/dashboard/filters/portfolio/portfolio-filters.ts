import { buildActiveFilterDescriptors, hasActiveFilters } from "../filter-active";
import { buildFilterHref } from "../filter-params";
import type { ActiveFilterDescriptor, FilterParamsRecord, ListPageFilterConfig } from "../types";

export const PORTFOLIO_BASE_PATH = "/dashboard/portfolio";

export type PortfolioFilterValue = "all" | "due" | "paid" | "authorized" | "refunded";

export type PortfolioFilters = {
  q: string;
  payment: PortfolioFilterValue;
  year: number | null;
};

export const PORTFOLIO_PAYMENT_OPTIONS: readonly { id: PortfolioFilterValue; label: string }[] = [
  { id: "all", label: "All" },
  { id: "due", label: "Awaiting payment" },
  { id: "authorized", label: "Authorized" },
  { id: "paid", label: "Paid" },
  { id: "refunded", label: "Refunded" },
] as const;

export const PORTFOLIO_FILTER_DEFAULTS: Record<string, string | undefined> = {
  q: undefined,
  payment: "all",
  year: undefined,
};

export const PORTFOLIO_FILTER_CONFIG: ListPageFilterConfig = {
  basePath: PORTFOLIO_BASE_PATH,
  defaults: PORTFOLIO_FILTER_DEFAULTS,
  filters: [
    {
      kind: "search",
      param: "q",
      label: "Search collection",
      placeholder: "Filter by title…",
    },
    {
      kind: "chips",
      param: "payment",
      label: "Payment status",
      options: PORTFOLIO_PAYMENT_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
      placement: "primary",
    },
    {
      kind: "chips",
      param: "year",
      label: "Acquired in",
      options: [],
      placement: "sheet",
    },
  ],
};

const PAYMENT_VALUES = new Set(PORTFOLIO_PAYMENT_OPTIONS.map((o) => o.id));

export function parsePortfolioParams(raw: {
  q?: string;
  payment?: string;
  year?: string;
}): PortfolioFilters {
  const payment =
    raw.payment && PAYMENT_VALUES.has(raw.payment as PortfolioFilterValue)
      ? (raw.payment as PortfolioFilterValue)
      : "all";
  const yearRaw = raw.year;
  let year: number | null = null;
  if (yearRaw) {
    const n = Number.parseInt(yearRaw, 10);
    if (Number.isFinite(n) && n >= 1900 && n <= 3000) year = n;
  }
  return {
    q: (raw.q ?? "").trim(),
    payment,
    year,
  };
}

export function portfolioFiltersToParams(filters: PortfolioFilters): FilterParamsRecord {
  return {
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.payment !== "all" ? { payment: filters.payment } : {}),
    ...(filters.year != null ? { year: String(filters.year) } : {}),
  };
}

export function buildPortfolioHref(
  current: PortfolioFilters,
  patch: Partial<{ q: string | null; payment: PortfolioFilterValue; year: number | null }>,
): string {
  const next: PortfolioFilters = {
    q: patch.q === undefined ? current.q : (patch.q ?? ""),
    payment: patch.payment ?? current.payment,
    year: patch.year === undefined ? current.year : patch.year,
  };
  return buildFilterHref(PORTFOLIO_BASE_PATH, portfolioFiltersToParams(next), {
    omitDefaults: PORTFOLIO_FILTER_DEFAULTS,
  });
}

export function hasPortfolioActiveFilters(filters: PortfolioFilters): boolean {
  return hasActiveFilters(portfolioFiltersToParams(filters), PORTFOLIO_FILTER_DEFAULTS, [
    "q",
    "payment",
    "year",
  ]);
}

export function getPortfolioActiveFilters(filters: PortfolioFilters): ActiveFilterDescriptor[] {
  const paymentLabel =
    PORTFOLIO_PAYMENT_OPTIONS.find((o) => o.id === filters.payment)?.label ?? filters.payment;

  return buildActiveFilterDescriptors(
    {
      basePath: PORTFOLIO_BASE_PATH,
      params: portfolioFiltersToParams(filters),
      defaults: PORTFOLIO_FILTER_DEFAULTS,
      omitDefaults: PORTFOLIO_FILTER_DEFAULTS,
    },
    [
      {
        param: "q",
        isActive: () => Boolean(filters.q.trim()),
        label: () => `Search: ${filters.q}`,
        clearPatch: () => ({ q: undefined }),
      },
      {
        param: "payment",
        isActive: () => filters.payment !== "all",
        label: () => paymentLabel,
        clearPatch: () => ({ payment: undefined }),
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

export function countPortfolioSheetFilters(filters: PortfolioFilters): number {
  return filters.year != null ? 1 : 0;
}

/** Active dimensions in the mobile filter sheet (payment + year). */
export function countPortfolioMobileSheetFilters(filters: PortfolioFilters): number {
  let count = 0;
  if (filters.payment !== "all") count += 1;
  if (filters.year != null) count += 1;
  return count;
}

export const PORTFOLIO_INLINE_YEAR_THRESHOLD = 8;
