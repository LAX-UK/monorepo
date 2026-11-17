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
  chips: DeliveriesFilterChip[];
  pagination: ReturnType<typeof deliveriesPagination>;
  loadError: string | null;
};

/** Data and composition boundary for `/admin/deliveries`; a failed read becomes the error state. */
export async function loadAdminDeliveriesPage(sp: DeliveriesSearch): Promise<DeliveriesPageModel> {
  const filters = parseDeliveriesSearch(sp);
  const base = { filters, filtered: hasDeliveriesFilters(filters) };
  let page: DeliveriesPage;
  try {
    page = await getAdminDeliveries(deliveriesApiQuery(filters));
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "forbidden";
    return {
      ...base,
      page: null,
      selected: null,
      chips: [],
      pagination: null,
      loadError: forbidden ? DELIVERIES_COPY.error.forbidden : DELIVERIES_COPY.error.unavailable,
    };
  }
  const listed = filters.record && page.items.some((item) => item.lotId === filters.record);
  const selected =
    filters.record && !listed ? await getAdminDelivery(filters.record).catch(() => null) : null;
  return {
    ...base,
    page,
    selected,
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
