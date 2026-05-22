import type { SaleDeliveryMode } from "@auction/types";

/** Primary navigation tabs from `calendar.html` (marketing calendar). */
export const CALENDAR_PRIMARY_TABS = [
  "upcoming",
  "live",
  "results",
  "newLots",
  "privateSales",
] as const;
export type CalendarPrimaryTab = (typeof CALENDAR_PRIMARY_TABS)[number];

export type CalendarSalesUrlParams = {
  tab?: CalendarPrimaryTab;
  /** Legacy filter still supported for deep links; tab wins when both set. */
  filter?: string;
  categoryId?: string;
  deliveryMode?: SaleDeliveryMode | "all";
  location?: "all" | "online" | string;
  sort?: "startAsc" | "createdDesc";
  month?: number;
  year?: number;
  minPrice?: number;
  maxPrice?: number;
  /** Catalogue layout for calendar browse (grid = default card rows, list = compact). */
  view?: "grid" | "list";
  page?: number;
};

function firstString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

export function parseCalendarPrimaryTab(
  sp: Record<string, string | string[] | undefined>,
): CalendarPrimaryTab {
  const raw = firstString(sp.tab)?.toLowerCase();
  if (raw && (CALENDAR_PRIMARY_TABS as readonly string[]).includes(raw)) {
    return raw as CalendarPrimaryTab;
  }
  const legacy = firstString(sp.filter)?.toLowerCase();
  if (legacy === "ended") return "results";
  if (legacy === "live" || legacy === "active") return "live";
  if (legacy === "scheduled") return "upcoming";
  return "upcoming";
}

export function parseDeliveryMode(
  sp: Record<string, string | string[] | undefined>,
): SaleDeliveryMode | "all" {
  const v = firstString(sp.delivery)?.toLowerCase();
  if (v === "online" || v === "onsite") return v;
  return "all";
}

/** `online` | city name slug key | `all` */
export function parseLocationFilter(
  sp: Record<string, string | string[] | undefined>,
): "all" | "online" | string {
  const v = firstString(sp.location)?.trim();
  if (!v || v.toLowerCase() === "all") return "all";
  if (v.toLowerCase() === "online") return "online";
  return v;
}

export function parseSort(
  sp: Record<string, string | string[] | undefined>,
): "startAsc" | "createdDesc" {
  const v = firstString(sp.sort);
  if (v === "createdDesc") return "createdDesc";
  return "startAsc";
}

export function parseMonth(sp: Record<string, string | string[] | undefined>): number | undefined {
  const v = firstString(sp.month);
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n) || n < 1 || n > 12) return undefined;
  return n;
}

export function parseYear(sp: Record<string, string | string[] | undefined>): number | undefined {
  const v = firstString(sp.year);
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n) || n < 1970 || n > 2100) return undefined;
  return n;
}

export function parseCalendarPage(sp: Record<string, string | string[] | undefined>): number {
  const v = firstString(sp.page);
  if (!v) return 1;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 500) : 1;
}

export function parsePriceRange(sp: Record<string, string | string[] | undefined>): {
  minPrice?: number;
  maxPrice?: number;
} {
  const minRaw = firstString(sp.minPrice);
  const maxRaw = firstString(sp.maxPrice);
  const min = minRaw != null ? Number.parseInt(minRaw, 10) : Number.NaN;
  const max = maxRaw != null ? Number.parseInt(maxRaw, 10) : Number.NaN;
  return {
    ...(Number.isFinite(min) ? { minPrice: min } : {}),
    ...(Number.isFinite(max) ? { maxPrice: max } : {}),
  };
}

/** Resolved calendar URL state (server passes to client nav + sidebar). */
export type CalendarSalesUrlState = {
  tab: CalendarPrimaryTab;
  categoryId?: string;
  deliveryMode: SaleDeliveryMode | "all";
  location: "all" | "online" | string;
  sort: "startAsc" | "createdDesc";
  month?: number;
  year?: number;
  minPrice?: number;
  maxPrice?: number;
  view: "grid" | "list";
  page?: number;
};

/** Patch type allows explicit `undefined` to clear keys (exactOptionalPropertyTypes). */
export type CalendarSalesUrlPatch = {
  [K in keyof CalendarSalesUrlState]?: CalendarSalesUrlState[K] | undefined;
};

const CLEARABLE_KEYS = new Set<string>([
  "categoryId",
  "month",
  "year",
  "minPrice",
  "maxPrice",
  "page",
]);

/** Merge partial updates; `undefined` in patch removes optional query keys (exactOptionalPropertyTypes-safe). */
export function calendarSalesHrefFromState(
  current: CalendarSalesUrlState,
  patch: CalendarSalesUrlPatch,
): string {
  const next: CalendarSalesUrlState = { ...current };
  for (const key of Object.keys(patch) as (keyof CalendarSalesUrlState)[]) {
    const v = patch[key];
    if (v === undefined && CLEARABLE_KEYS.has(key)) {
      delete (next as Record<string, unknown>)[key];
      continue;
    }
    if (v !== undefined) {
      (next as Record<string, unknown>)[key] = v;
    }
  }
  return calendarSalesHref(next);
}

/** Build `/sales` URL with calendar query params (shareable, SSR-friendly). */
export function calendarSalesHref(params: CalendarSalesUrlParams): string {
  const q = new URLSearchParams();
  const tab = params.tab ?? "upcoming";
  if (tab !== "upcoming") q.set("tab", tab);
  if (params.categoryId) q.set("categoryId", params.categoryId);
  if (params.deliveryMode && params.deliveryMode !== "all") {
    q.set("delivery", params.deliveryMode);
  }
  if (params.location && params.location !== "all") {
    q.set("location", params.location);
  }
  if (params.sort && params.sort !== "startAsc") {
    q.set("sort", params.sort);
  }
  if (params.month != null) q.set("month", String(params.month));
  if (params.year != null) q.set("year", String(params.year));
  if (params.minPrice != null) q.set("minPrice", String(params.minPrice));
  if (params.maxPrice != null) q.set("maxPrice", String(params.maxPrice));
  if (params.view === "list") q.set("view", "list");
  if (params.page != null && params.page > 1) q.set("page", String(params.page));
  const qs = q.toString();
  return qs ? `/sales?${qs}` : "/sales";
}

/** Count non-default filters for mobile “Filters (N)” badge. */
export function countActiveCalendarFilters(state: CalendarSalesUrlState): number {
  let n = 0;
  if (state.categoryId) n += 1;
  if (state.deliveryMode !== "all") n += 1;
  if (state.location !== "all") n += 1;
  if (state.month != null) n += 1;
  if (state.year != null) n += 1;
  if (state.minPrice != null) n += 1;
  if (state.maxPrice != null) n += 1;
  return n;
}
