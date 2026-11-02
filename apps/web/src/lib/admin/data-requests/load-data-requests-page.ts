import "server-only";

import {
  getAdminDataRequestSummary,
  getAdminDataRequests,
} from "@/lib/data/http/admin-data-requests.reader";
import type {
  DataRequestList,
  DataRequestSummary,
} from "@auction/identity-contracts/data-requests";
import {
  type DataRequestsFilters,
  type DataRequestsSearch,
  dataRequestsApiQuery,
  dataRequestsHref,
  hasDataRequestsFilters,
  parseDataRequestsSearch,
} from "./data-requests-search";

export type DataRequestsPagination = {
  summary: string;
  prevHref: string | null;
  nextHref: string | null;
};

export function pageSummary(page: number, shown: number, more: boolean): string {
  const noun = shown === 1 ? "request" : "requests";
  return page === 1 && !more ? `${shown} ${noun}` : `Page ${page} · ${shown} ${noun}`;
}

/** Previous and next links for a cursor list: the pages before this one ride along in `trail`. */
export function paginationFor(
  sp: DataRequestsSearch,
  filters: DataRequestsFilters,
  list: Pick<DataRequestList, "items" | "nextCursor">,
): DataRequestsPagination | null {
  if (list.items.length === 0) return null;
  const earlier = filters.trail;
  const previous = earlier.length > 0 ? earlier[earlier.length - 1] : undefined;
  return {
    summary: pageSummary(earlier.length + 1, list.items.length, list.nextCursor !== null),
    prevHref:
      previous === undefined
        ? null
        : dataRequestsHref(sp, {
            cursor: previous || null,
            trail: earlier.length > 1 ? JSON.stringify(earlier.slice(0, -1)) : null,
          }),
    nextHref: list.nextCursor
      ? dataRequestsHref(sp, {
          cursor: list.nextCursor,
          trail: JSON.stringify([...earlier, filters.cursor]),
        })
      : null,
  };
}

export type DataRequestsPageModel = {
  filters: DataRequestsFilters;
  filtered: boolean;
  list: DataRequestList | null;
  summary: DataRequestSummary | null;
  pagination: DataRequestsPagination | null;
  loadError: string | null;
};

/** Data and composition boundary for `/admin/compliance/data-requests`. */
export async function loadAdminDataRequestsPage(
  sp: DataRequestsSearch,
): Promise<DataRequestsPageModel> {
  const filters = parseDataRequestsSearch(sp);
  const filtered = hasDataRequestsFilters(filters);
  const [list, summary] = await Promise.allSettled([
    getAdminDataRequests(dataRequestsApiQuery(filters)),
    getAdminDataRequestSummary(),
  ]);
  const summaryValue = summary.status === "fulfilled" ? summary.value : null;
  if (list.status === "rejected") {
    const message = list.reason instanceof Error ? list.reason.message : "";
    return {
      filters,
      filtered,
      list: null,
      summary: summaryValue,
      pagination: null,
      loadError:
        message === "forbidden"
          ? "You do not have access to data requests."
          : "Identity didn't answer. Overdue alerts still go out from Identity while this page is down.",
    };
  }
  return {
    filters,
    filtered,
    list: list.value,
    summary: summaryValue,
    pagination: paginationFor(sp, filters, list.value),
    loadError: null,
  };
}
