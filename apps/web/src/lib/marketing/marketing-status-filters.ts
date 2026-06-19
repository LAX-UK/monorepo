import type { SearchEndingWindow } from "@/lib/marketing/parse-search-params";
import type { CalendarPrimaryTab } from "@/lib/marketing/sales-calendar-params";
import type { LotStatus, SaleStatus } from "@auction/types";

export type SaleroomCatalogStatus = "all" | "live" | "upcoming" | "ended";

/** Filter chip copy for lot status (search). Keys align with API `LotStatus`. */
export const LOT_STATUS_FILTER_LABELS: Partial<Record<LotStatus, string>> = {
  active: "Live now",
  scheduled: "Upcoming",
  ended: "Ended",
};

export function lotStatusFilterLabel(status: LotStatus): string {
  return LOT_STATUS_FILTER_LABELS[status] ?? status.replaceAll("_", " ");
}

export function searchEndingFilterLabel(window: SearchEndingWindow): string {
  return window === "24h" ? "Ending < 24h" : window;
}

/** Saleroom catalog facet labels (filter keys are UI facets, not raw API enums). */
export const SALEROOM_CATALOG_FILTER_LABELS: Record<SaleroomCatalogStatus, string> = {
  all: "All",
  live: "Live",
  upcoming: "Upcoming",
  ended: "Ended",
};

export function saleroomCatalogFilterLabel(value: SaleroomCatalogStatus): string {
  return SALEROOM_CATALOG_FILTER_LABELS[value];
}

/** Sales calendar primary tab labels. */
export const SALES_CALENDAR_TAB_LABELS: Record<CalendarPrimaryTab, string> = {
  upcoming: "Upcoming",
  live: "Live Now",
  results: "Auction Results",
  newLots: "New Lots",
  privateSales: "Private Sales",
};

export function salesCalendarTabLabel(tab: CalendarPrimaryTab): string {
  return SALES_CALENDAR_TAB_LABELS[tab];
}

/** Map saleroom catalog facet → lot API statuses for filtering. */
export function saleroomFacetToLotStatuses(
  facet: Exclude<SaleroomCatalogStatus, "all">,
): LotStatus[] {
  switch (facet) {
    case "live":
      return ["active"];
    case "upcoming":
      return ["scheduled"];
    case "ended":
      return ["ended"];
  }
}

/** Map saleroom catalog facet → sale API statuses for filtering. */
export function saleroomFacetToSaleStatuses(
  facet: Exclude<SaleroomCatalogStatus, "all">,
): SaleStatus[] {
  switch (facet) {
    case "live":
      return ["active"];
    case "upcoming":
      return ["scheduled"];
    case "ended":
      return ["ended"];
  }
}
