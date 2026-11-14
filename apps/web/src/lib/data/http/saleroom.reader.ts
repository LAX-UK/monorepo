import "server-only";

import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import {
  type GetRelatedSalesParams,
  type RelatedSale,
  saleFollowStateSchema,
} from "@/lib/data/http/saleroom.schema";
import { cookies } from "next/headers";

export type { RelatedSale, GetRelatedSalesParams };

async function authedInit(init: RequestInit = {}): Promise<RequestInit> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (cookieHeader) {
    return { ...init, headers: { ...(init.headers ?? {}), Cookie: cookieHeader } };
  }
  return init;
}

/** Returns `isFollowing` for the current viewer (anonymous callers always get `false`).
 * SSR only reads this for authenticated users (see page orchestrator).
 */
export async function getServerSaleFollowState(id: string): Promise<{ isFollowing: boolean }> {
  const base = getServerApiBase();
  const url = `${base}/sales/${encodeURIComponent(id)}/follow`;
  const res = await fetch(url, await authedInit({ cache: "no-store" }));
  if (!res.ok) return { isFollowing: false };
  const body = await readJsonBody(res);
  return readDataEnvelope(body, saleFollowStateSchema, `GET /sales/${id}/follow`);
}

/** Related sales with same category (excluding current); the session-free read. */
export { getPublicRelatedSales as getServerRelatedSales } from "@/lib/data/http/public-catalogue.server";
