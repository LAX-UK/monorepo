import "server-only";

import { CATALOGUE_SALES_TAG, publicLotTag, publicSaleTag } from "@/lib/data/cache-tags";
import { categoryRowSchema } from "@/lib/data/http/categories.schema";
import { readDataEnvelope, readJsonBody, readListEnvelope } from "@/lib/data/http/envelope";
import { publicLotViewEnvelopeSchema } from "@/lib/data/http/lots.schema";
import { isWithdrawnLotRow } from "@/lib/data/http/object-guards";
import {
  type GetRelatedSalesParams,
  type RelatedSale,
  relatedSaleRowSchema,
} from "@/lib/data/http/saleroom.schema";
import {
  bidderCountSchema,
  saleLotsPageDataSchema,
  saleShellDataSchema,
} from "@/lib/data/http/sales.schema";
import type { GetSaleLotsPageParams, SaleLotsPage, SaleShell } from "@/lib/data/http/sales.types";
import { getServerApiBase } from "@/lib/data/http/server-api-base";
import type { Category, Lot, PublicLotView } from "@auction/types";
import { cache } from "react";

/*
 * Session-free reads for the public sale and lot pages (CO-7).
 *
 * Nothing here reads cookies or headers, and no request carries the visitor's session: the API
 * answers every one of them as it answers a signed-out visitor, so the result is the same for
 * everyone and can be cached. Each read carries the tag of the lot or sale it shows
 * (`public-lot:<id>`, `public-sale:<id>`), which the API and the worker drop through
 * `POST /api/revalidate` when that lot or sale changes; the window below is only the fallback.
 * What is personal (watching, your bids, registration, telephone booking) comes from
 * `/api/sales/:id/me` and `/api/lots/:id/me` in the browser; the live bid state comes from the
 * socket and a no-store read, never from these.
 */

/** Fallback window when a purge is missed. */
export const PUBLIC_PAGE_REVALIDATE_SECONDS = 60;

function publicFetch(path: string, tags: string[]): Promise<Response> {
  return fetch(`${getServerApiBase()}${path}`, {
    next: { revalidate: PUBLIC_PAGE_REVALIDATE_SECONDS, tags },
  });
}

/** The public sale, or null when the API says 404 (missing, private, test or hidden). */
export const getPublicSaleShell = cache(async function getPublicSaleShell(
  id: string,
): Promise<SaleShell | null> {
  const res = await publicFetch(`/sales/${encodeURIComponent(id)}`, [
    publicSaleTag(id),
    CATALOGUE_SALES_TAG,
  ]);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale: ${res.status}`);
  const body = await readJsonBody(res);
  const shell = readDataEnvelope(body, saleShellDataSchema, `GET /sales/${id}`);
  // A signed-out answer has no viewer; drop one if it ever came back, so nothing personal is cached.
  const { viewer: _viewer, ...rest } = shell;
  return rest;
});

/** One page of a public sale's catalogue, as a signed-out visitor sees it. */
export const getPublicSaleLotsPage = cache(async function getPublicSaleLotsPage(
  params: GetSaleLotsPageParams,
): Promise<SaleLotsPage | null> {
  const pageSize = Math.min(Math.max(params.pageSize ?? 40, 1), 48);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const sort = params.sort ?? "lot";
  const res = await publicFetch(
    `/sales/${encodeURIComponent(params.id)}/lots?limit=${pageSize}&offset=${offset}&sort=${sort}`,
    [publicSaleTag(params.id)],
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale lots: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, saleLotsPageDataSchema, `GET /sales/${params.id}/lots`);
});

/**
 * The public lot, or null for a 404 and for a withdrawn lot (which has its own page and read).
 * Its price and status are a first paint only: the bid panel replaces them from the socket.
 */
export const getPublicLotById = cache(async function getPublicLotById(
  id: string,
): Promise<Lot | PublicLotView | null> {
  const res = await publicFetch(`/lots/${encodeURIComponent(id)}`, [publicLotTag(id)]);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load lot: ${res.status}`);
  const body = await readJsonBody(res);
  if (isWithdrawnLotRow((body as { data?: unknown } | null)?.data)) return null;
  return readDataEnvelope(body, publicLotViewEnvelopeSchema, `GET /lots/${id}`);
});

/** Public categories (names for the sale's labels); empty on any failure. */
export const getPublicCategories = cache(async function getPublicCategories(): Promise<Category[]> {
  try {
    const res = await publicFetch("/categories", [CATALOGUE_SALES_TAG]);
    if (!res.ok) return [];
    const body = await readJsonBody(res);
    return readListEnvelope(body, categoryRowSchema, "GET /categories").rows as Category[];
  } catch {
    return [];
  }
});

/** Related sales with the same category (excluding this one). Public and cached. */
export async function getPublicRelatedSales(params: GetRelatedSalesParams): Promise<RelatedSale[]> {
  const limit = Math.min(Math.max(params.limit ?? 4, 1), 12);
  const qs = new URLSearchParams({
    limit: String(limit + 1),
    offset: "0",
    statuses: "scheduled,active",
    sort: "startAsc",
  });
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  const res = await fetch(`${getServerApiBase()}/sales?${qs.toString()}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(body, relatedSaleRowSchema, "GET /sales?related");
  return rows.filter((row) => row.sale.id !== params.id).slice(0, limit);
}

/** Masked registered bidder count for social proof (public endpoint). */
export async function getPublicSaleBidderCount(saleId: string): Promise<number | null> {
  const res = await publicFetch(`/sales/${encodeURIComponent(saleId)}/bidders?limit=1&offset=0`, [
    publicSaleTag(saleId),
    CATALOGUE_SALES_TAG,
  ]);
  if (!res.ok) return null;
  const body = await readJsonBody(res);
  const parsed = readDataEnvelope(body, bidderCountSchema, `GET /sales/${saleId}/bidders`);
  const total = parsed.total;
  return typeof total === "number" && Number.isFinite(total) ? total : null;
}
