import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readData, safeReadData } from "@/lib/data/http/envelope";
import {
  type DataRequestList,
  type DataRequestRecord,
  type DataRequestSummary,
  dataRequestListSchema,
  dataRequestRecordSchema,
  dataRequestSummarySchema,
} from "@auction/identity-contracts/data-requests";

const PATH = "/admin/data-requests";

/** One page of the merged list, emails masked; throws `forbidden` when the person may not look. */
export async function getAdminDataRequests(query: URLSearchParams): Promise<DataRequestList> {
  const res = await authedServerFetch(`${PATH}?${query.toString()}`);
  return readData(res, dataRequestListSchema, {
    context: "GET /admin/data-requests",
    notOkMessage: (status) =>
      status === 403 ? "forbidden" : `Data requests unavailable: ${status}`,
  });
}

/** Counts for the strips, tabs, nav badge and Dashboard; throws `forbidden` or when unavailable. */
export async function getAdminDataRequestSummary(): Promise<DataRequestSummary> {
  const res = await authedServerFetch(`${PATH}/summary`);
  return readData(res, dataRequestSummarySchema, {
    context: "GET /admin/data-requests/summary",
    notOkMessage: (status) => (status === 403 ? "forbidden" : `Summary unavailable: ${status}`),
  });
}

export type DataRequestRead =
  | { ok: true; record: DataRequestRecord }
  | { ok: false; reason: "not_found" | "forbidden" | "unavailable" };

/** One request with the person's details. Opening it is audited by the API. */
export async function getAdminDataRequest(reference: string): Promise<DataRequestRead> {
  const res = await authedServerFetch(`${PATH}/${encodeURIComponent(reference)}`).catch(() => null);
  if (!res) return { ok: false, reason: "unavailable" };
  if (res.status === 404) return { ok: false, reason: "not_found" };
  if (res.status === 403) return { ok: false, reason: "forbidden" };
  try {
    const record = await safeReadData(res, dataRequestRecordSchema, {
      context: "GET /admin/data-requests/:reference",
      nullStatuses: [],
    });
    return record ? { ok: true, record } : { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
