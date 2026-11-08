import "server-only";

import {
  type DealsFilters,
  type DealsSearch,
  dealsApiQuery,
  dealsPagination,
  parseDealsSearch,
} from "@/lib/admin/private-sales/private-sales-search";
import { getAdminDeals } from "@/lib/data/http/admin-private-sales.reader";
import type { DealListPage } from "@/lib/data/http/admin-private-sales.schema";

export type DealsPageModel = {
  filters: DealsFilters;
  page: DealListPage | null;
  pagination: ReturnType<typeof dealsPagination>;
  loadError: string | null;
};

/** Data and composition boundary for `/admin/private-sales`. */
export async function loadAdminDealsPage(sp: DealsSearch): Promise<DealsPageModel> {
  const filters = parseDealsSearch(sp);
  try {
    const page = await getAdminDeals(dealsApiQuery(filters));
    return {
      filters,
      page,
      pagination: dealsPagination(sp, filters, {
        itemCount: page.items.length,
        nextCursor: page.nextCursor,
      }),
      loadError: null,
    };
  } catch (error) {
    return {
      filters,
      page: null,
      pagination: null,
      loadError:
        error instanceof Error && error.message === "forbidden"
          ? "You do not have access to private sales."
          : "The Bid API didn't answer. Deals are safe; try again in a moment.",
    };
  }
}
