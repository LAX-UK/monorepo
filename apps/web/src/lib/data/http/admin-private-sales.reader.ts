import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody, safeReadData } from "@/lib/data/http/envelope";
import {
  type DealAttentionCount,
  type DealListPage,
  type DealRecord,
  dealAttentionCountSchema,
  dealListPageSchema,
  dealRecordSchema,
} from "./admin-private-sales.schema";

/** One page of the Private sales list; throws when the Bid API does not answer. */
export async function getAdminDeals(query: URLSearchParams): Promise<DealListPage> {
  const res = await authedServerFetch(`/admin/private-sales?${query.toString()}`);
  if (res.status === 403) throw new Error("forbidden");
  if (!res.ok) throw new Error(`Private sales unavailable: ${res.status}`);
  return readDataEnvelope(await readJsonBody(res), dealListPageSchema, "GET /admin/private-sales");
}

/** One deal by reference; null when there is none or the person may not see it. */
export async function getAdminDeal(ref: string): Promise<DealRecord | null> {
  const res = await authedServerFetch(`/admin/private-sales/${encodeURIComponent(ref)}`);
  return safeReadData(res, dealRecordSchema, {
    context: "GET /admin/private-sales/:ref",
    nullStatuses: [404],
    notOkMessage: (status) => (status === 403 ? "forbidden" : `Deal unavailable: ${status}`),
  });
}

/** How many settled deals need attention for this person; throws when the Bid API does not answer. */
export async function getAdminDealsAttentionCount(): Promise<DealAttentionCount> {
  const res = await authedServerFetch("/admin/private-sales/attention-count");
  if (res.status === 403) throw new Error("forbidden");
  if (!res.ok) throw new Error(`Private sales unavailable: ${res.status}`);
  return readDataEnvelope(
    await readJsonBody(res),
    dealAttentionCountSchema,
    "GET /admin/private-sales/attention-count",
  );
}
