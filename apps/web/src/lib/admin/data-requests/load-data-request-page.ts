import "server-only";

import {
  type DataRequestRead,
  type DealHold,
  getAdminDataRequest,
  getAdminDataRequestHolds,
  getAdminDataRequests,
} from "@/lib/data/http/admin-data-requests.reader";
import { londonToday } from "@auction/staff-ui";
import {
  DATA_REQUESTS_PATH,
  type DataRequestsFilters,
  type DataRequestsSearch,
  dataRequestHref,
  dataRequestsApiQuery,
  dataRequestsListHref,
  listSearchFromRecordSearch,
} from "./data-requests-search";

/** Where the request sits in the page of the list it was opened from: "‹ 3 of 50 ›" and J/K. */
export type DataRequestPager = {
  position: number;
  total: number;
  previousHref: string | null;
  nextHref: string | null;
};

export type DataRequestPageModel =
  | {
      kind: "ready";
      record: Extract<DataRequestRead, { ok: true }>["record"];
      today: string;
      /** The list it came from, for the breadcrumb. */
      listHref: string;
      pager: DataRequestPager | null;
      /** The private sale deals keeping this person's records; none for most people. */
      holds: DealHold[];
    }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "unavailable" };

async function pagerFor(
  reference: string,
  list: DataRequestsFilters,
): Promise<DataRequestPager | null> {
  const page = await getAdminDataRequests(dataRequestsApiQuery(list)).catch(() => null);
  if (!page) return null;
  const references = page.items.map((item) => item.reference);
  const index = references.indexOf(reference);
  if (index < 0) return null;
  const href = (ref: string | undefined) => (ref ? dataRequestHref(ref, list) : null);
  return {
    position: index + 1,
    total: references.length,
    previousHref: href(references[index - 1]),
    nextHref: href(references[index + 1]),
  };
}

/** A request with the person's details, and its place in the list it was opened from. */
export async function loadAdminDataRequestPage(
  reference: string,
  sp: DataRequestsSearch,
): Promise<DataRequestPageModel> {
  const list = listSearchFromRecordSearch(sp);
  const [read, pager, holds] = await Promise.all([
    getAdminDataRequest(reference),
    list ? pagerFor(reference.toUpperCase(), list) : Promise.resolve(null),
    getAdminDataRequestHolds(reference),
  ]);
  if (!read.ok) return { kind: read.reason };
  return {
    kind: "ready",
    record: read.record,
    today: londonToday(),
    listHref: list ? dataRequestsListHref(list) : DATA_REQUESTS_PATH,
    pager,
    holds,
  };
}
