import "server-only";

import { getAdminDeliveries, getAdminDelivery } from "@/lib/data/http/admin-deliveries.reader";
import type { DeliveriesPage, DeliveryView } from "@/lib/data/http/admin-deliveries.schema";
import { DELIVERIES_COPY } from "./deliveries-copy";
import {
  type DeliveriesFilterChip,
  type DeliveriesFilters,
  type DeliveriesSearch,
  deliveriesApiQuery,
  deliveriesFilterChips,
  deliveriesPagination,
  hasDeliveriesFilters,
  parseDeliveriesSearch,
} from "./deliveries.vm";

export type DeliveriesPageModel = {
  filters: DeliveriesFilters;
  filtered: boolean;
  page: DeliveriesPage | null;
  /** The lot in the URL when it is not on this page of the view (a shared link, another tab). */
  selected: DeliveryView | null;
  /**
   * The lot in the URL could not be read (the API failed, not a 404): the panel says so with
   * Try again, never "not found".
   */
  selectedError: boolean;
  /** The Bid API refused the list although the page let the person in: access denied. */
  denied: boolean;
  chips: DeliveriesFilterChip[];
  pagination: ReturnType<typeof deliveriesPagination>;
  loadError: string | null;
};

/**
 * Data and composition boundary for `/admin/deliveries`. A failed read becomes the error state, a
 * refused one the access-denied state, and a lot the API has no delivery for (404) "not found".
 */
export async function loadAdminDeliveriesPage(sp: DeliveriesSearch): Promise<DeliveriesPageModel> {
  const filters = parseDeliveriesSearch(sp);
  const base = { filters, filtered: hasDeliveriesFilters(filters) };
  let page: DeliveriesPage;
  try {
    page = await getAdminDeliveries(deliveriesApiQuery(filters));
  } catch (error) {
    const denied = error instanceof Error && error.message === "forbidden";
    return {
      ...base,
      page: null,
      selected: null,
      selectedError: false,
      denied,
      chips: [],
      pagination: null,
      loadError: denied ? null : DELIVERIES_COPY.error.unavailable,
    };
  }
  const listed = filters.record && page.items.some((item) => item.lotId === filters.record);
  let selected: DeliveryView | null = null;
  let selectedError = false;
  if (filters.record && !listed) {
    try {
      // A 404 is null (no delivery for this lot); anything else is a failure, not "not found".
      selected = await getAdminDelivery(filters.record);
    } catch {
      selectedError = true;
    }
  }
  return {
    ...base,
    page,
    selected,
    selectedError,
    denied: false,
    chips: deliveriesFilterChips(filters, sp, page.sales),
    pagination: deliveriesPagination(sp, {
      offset: page.offset,
      limit: page.limit,
      total: page.total,
      itemCount: page.items.length,
    }),
    loadError: null,
  };
}
