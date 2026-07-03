import "server-only";

import { readDataEnvelope, readJsonBody, readListEnvelope } from "@/lib/data/http/envelope";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import {
  type GetRelatedSalesParams,
  type RelatedSale,
  relatedSaleRowSchema,
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

/** Related sales with same category (excluding current). Cached for SEO + fewer round trips. */
export async function getServerRelatedSales(params: GetRelatedSalesParams): Promise<RelatedSale[]> {
  const limit = Math.min(Math.max(params.limit ?? 4, 1), 12);
  const base = getServerApiBase();
  const qs = new URLSearchParams({
    limit: String(limit + 1),
    offset: "0",
    statuses: "scheduled,active",
    sort: "startAsc",
  });
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  const url = `${base}/sales?${qs.toString()}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(body, relatedSaleRowSchema, "GET /sales?related");
  return rows.filter((row) => row.sale.id !== params.id).slice(0, limit);
}
