import { getSaleDeliveryModeLabel } from "@/lib/sale-type-presentation";
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

export type CalendarPrimaryTabDefinition = {
  id: CalendarPrimaryTab;
  label: string;
};

const CALENDAR_PRIMARY_TAB_DEFINITIONS: readonly CalendarPrimaryTabDefinition[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "live", label: "Live Now" },
  { id: "results", label: "Auction Results" },
  { id: "newLots", label: "New Lots" },
  { id: "privateSales", label: "Private Sales" },
];

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
  /** Catalogue layout for calendar browse (grid = card rows, list = compact, calendar = agenda by month). */
  view?: "grid" | "list" | "calendar";
  page?: number;
};

function firstString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

/** Case-insensitive match to the canonical camelCase tab id (e.g. `newlots` -> `newLots`). */
function matchCanonicalTab(raw: string | undefined): CalendarPrimaryTab | undefined {
  if (!raw) return undefined;
  const lowered = raw.toLowerCase();
  return CALENDAR_PRIMARY_TABS.find((t) => t.toLowerCase() === lowered);
}

export function parseCalendarPrimaryTab(
  sp: Record<string, string | string[] | undefined>,
): CalendarPrimaryTab {
  const match = matchCanonicalTab(firstString(sp.tab));
  if (match) return match;
  const legacy = firstString(sp.filter)?.toLowerCase();
  if (legacy === "ended") return "results";
  if (legacy === "live" || legacy === "active") return "live";
  if (legacy === "scheduled") return "upcoming";
  return "upcoming";
}

/** True when the URL explicitly selects a calendar section (tab or legacy filter). */
export function hasExplicitCalendarTab(sp: Record<string, string | string[] | undefined>): boolean {
  if (matchCanonicalTab(firstString(sp.tab))) {
    return true;
  }
  const legacy = firstString(sp.filter)?.toLowerCase();
  if (!legacy) return false;
  return legacy === "ended" || legacy === "live" || legacy === "active" || legacy === "scheduled";
}

/** Default landing tab when no explicit tab is in the URL. */
export function resolveDefaultCalendarPrimaryTab(hasLiveSales: boolean): CalendarPrimaryTab {
  return hasLiveSales ? "live" : "upcoming";
}

/** Tab nav definitions; Live Now leads when active sales exist. */
export function getCalendarPrimaryTabDefinitions(
  hasLiveSales: boolean,
): CalendarPrimaryTabDefinition[] {
  if (!hasLiveSales) {
    return [...CALENDAR_PRIMARY_TAB_DEFINITIONS];
  }
  const live = CALENDAR_PRIMARY_TAB_DEFINITIONS.find((t) => t.id === "live");
  if (!live) return [...CALENDAR_PRIMARY_TAB_DEFINITIONS];
  return [live, ...CALENDAR_PRIMARY_TAB_DEFINITIONS.filter((t) => t.id !== "live")];
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
  view: "grid" | "list" | "calendar";
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
  // Always emit the tab explicitly. Tab links (including Upcoming) must carry an
  // explicit tab so the bare `/sales` auto-landing redirect (to Live Now when a
  // sale is live) does not swallow them. A hardcoded `/sales` remains the auto-land entry.
  const tab = params.tab ?? "upcoming";
  q.set("tab", tab);
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
  if (params.view === "list" || params.view === "calendar") q.set("view", params.view);
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

/** Preserve tab + view; drop facet filters (shareable reset for active chips + sheet). */
export function calendarClearFiltersHref(state: CalendarSalesUrlState): string {
  return calendarSalesHref({
    tab: state.tab,
    view: state.view,
  });
}

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function calendarDeliveryLabel(mode: SaleDeliveryMode | "all"): string | null {
  if (mode === "online" || mode === "onsite") return getSaleDeliveryModeLabel(mode);
  return null;
}

export function calendarLocationLabel(location: "all" | "online" | string): string | null {
  if (location === "all") return null;
  if (location === "online") return getSaleDeliveryModeLabel("online");
  return location.charAt(0).toUpperCase() + location.slice(1);
}

export function calendarMonthLabel(month: number): string {
  return MONTH_LABELS[month - 1] ?? String(month);
}

const CALENDAR_PRICE_LOCALE = "en-GB";

export function calendarPriceRangeLabel(state: CalendarSalesUrlState): string | null {
  if (state.minPrice != null && state.maxPrice != null) {
    return `£${state.minPrice.toLocaleString(CALENDAR_PRICE_LOCALE)}–£${state.maxPrice.toLocaleString(CALENDAR_PRICE_LOCALE)}`;
  }
  if (state.minPrice != null) {
    return `From £${state.minPrice.toLocaleString(CALENDAR_PRICE_LOCALE)}`;
  }
  if (state.maxPrice != null) {
    return `Up to £${state.maxPrice.toLocaleString(CALENDAR_PRICE_LOCALE)}`;
  }
  return null;
}

export type CalendarActiveFilterChip = {
  key: string;
  label: string;
  removeHref: string;
};

/** Removable active filter chips for the sales calendar toolbar strip. */
export function buildCalendarActiveFilterChips(
  state: CalendarSalesUrlState,
  categories: ReadonlyArray<{ id: string; name: string }>,
): CalendarActiveFilterChip[] {
  const chips: CalendarActiveFilterChip[] = [];

  const delivery = calendarDeliveryLabel(state.deliveryMode);
  if (delivery) {
    chips.push({
      key: "delivery",
      label: delivery,
      removeHref: calendarSalesHrefFromState(state, { deliveryMode: "all", page: undefined }),
    });
  }

  const location = calendarLocationLabel(state.location);
  if (location) {
    chips.push({
      key: "location",
      label: location,
      removeHref: calendarSalesHrefFromState(state, { location: "all", page: undefined }),
    });
  }

  if (state.categoryId) {
    const name = categories.find((c) => c.id === state.categoryId)?.name ?? "Department";
    chips.push({
      key: "categoryId",
      label: name,
      removeHref: calendarSalesHrefFromState(state, { categoryId: undefined, page: undefined }),
    });
  }

  if (state.month != null) {
    chips.push({
      key: "month",
      label: calendarMonthLabel(state.month),
      removeHref: calendarSalesHrefFromState(state, { month: undefined, page: undefined }),
    });
  }

  if (state.year != null) {
    chips.push({
      key: "year",
      label: String(state.year),
      removeHref: calendarSalesHrefFromState(state, { year: undefined, page: undefined }),
    });
  }

  const priceLabel = calendarPriceRangeLabel(state);
  if (priceLabel) {
    chips.push({
      key: "price",
      label: priceLabel,
      removeHref: calendarSalesHrefFromState(state, {
        minPrice: undefined,
        maxPrice: undefined,
        page: undefined,
      }),
    });
  }

  return chips;
}
