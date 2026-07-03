import "server-only";

import { hasAuthSessionCookie } from "@/lib/auth/session-cookie";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { CATALOGUE_FETCH_POLICIES, catalogueFetch } from "@/lib/data/http/catalogue-fetch";
import {
  readDataEnvelope,
  readJsonBody,
  readListEnvelope,
  readNullableListEnvelope,
} from "@/lib/data/http/envelope";
import { getServerApiBase, getServerHc } from "@/lib/data/http/hc-server";
import {
  bidderCountSchema,
  saleListRowSchema,
  saleLotsPageDataSchema,
  saleRegistrationItemsSchema,
  saleRegistrationMineRowSchema,
  saleShellDataSchema,
  saleWithLotsDataSchema,
  sitemapSaleRowSchema,
} from "@/lib/data/http/sales.schema";
import type {
  GetSaleLotsPageParams,
  ListSalesQuery,
  SaleLotsPage,
  SaleRegistrationMineRow,
  SaleShell,
  SaleWithLots,
  SitemapSale,
} from "@/lib/data/http/sales.types";
import { NO_STORE_FETCH_POLICY } from "@/lib/data/http/server-fetch-policy";
import type { SaleListRow } from "@/lib/sale-list-row";
import { cookies } from "next/headers";
import { cache } from "react";

export type {
  GetSaleLotsPageParams,
  ListSalesQuery,
  SaleLotsPage,
  SaleRegistrationMineRow,
  SaleShell,
  SaleViewerState,
  SaleWithLots,
  SitemapSale,
} from "@/lib/data/http/sales.types";

export type { SaleListRow } from "@/lib/sale-list-row";

function buildSalesQuery(params: ListSalesQuery): Record<string, string> {
  const q: Record<string, string> = {
    limit: String(params.limit ?? 24),
    offset: String(params.offset ?? 0),
  };
  if (params.statuses?.length) q.statuses = params.statuses.join(",");
  else if (params.status) q.status = params.status;
  if (params.categoryId) q.categoryId = params.categoryId;
  if (params.sort) q.sort = params.sort;
  return q;
}

export async function getServerSalesList(params: ListSalesQuery = {}): Promise<SaleListRow[]> {
  const client = await getServerHc();
  const res = await client.sales.$get({ query: buildSalesQuery(params) });
  if (!res.ok) throw new Error(`Failed to list sales: ${res.status}`);
  const body = await readJsonBody(res);
  const { rows } = readListEnvelope(body, saleListRowSchema, "GET /sales");
  return rows;
}

export const getServerSaleShell = cache(async function getServerSaleShell(
  id: string,
): Promise<SaleShell | null> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const authed = hasAuthSessionCookie(cookieHeader);
  const base = getServerApiBase();
  const res = await catalogueFetch(
    `${base}/sales/${encodeURIComponent(id)}`,
    authed ? NO_STORE_FETCH_POLICY : CATALOGUE_FETCH_POLICIES.sales,
    authed && cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, saleShellDataSchema, `GET /sales/${id}`);
});

export const getServerSaleWithLots = cache(async function getServerSaleWithLots(
  id: string,
): Promise<SaleWithLots | null> {
  const client = await getServerHc();
  const res = await client.sales[":id"].$get({ param: { id } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, saleWithLotsDataSchema, `GET /sales/${id}`);
});

/** Server-side paginated lots for the saleroom catalog. SSR-friendly, security-capped limits. */
export async function getServerSaleLotsPage(
  params: GetSaleLotsPageParams,
): Promise<SaleLotsPage | null> {
  /** Capped to API `listSaleLotsQuerySchema` max (48). Default 40  / API default. */
  const pageSize = Math.min(Math.max(params.pageSize ?? 40, 1), 48);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const sort = params.sort ?? "lot";

  const jar = await (await import("next/headers")).cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const base = getServerApiBase();
  const url = `${base}/sales/${encodeURIComponent(params.id)}/lots?limit=${pageSize}&offset=${offset}&sort=${sort}`;
  const init: RequestInit = cookieHeader
    ? { headers: { Cookie: cookieHeader }, cache: "no-store" }
    : { cache: "no-store" };
  const res = await fetch(url, init);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale lots: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, saleLotsPageDataSchema, `GET /sales/${params.id}/lots`);
}

/** Current user's paddle rows for a sale (empty when logged out). */
export async function getServerSaleMyRegistrations(
  saleId: string,
): Promise<SaleRegistrationMineRow[]> {
  const res = await authedServerFetch(`/sales/${encodeURIComponent(saleId)}/my-registrations`, {
    cache: "no-store",
  });
  if (res.status === 401) return [];
  if (!res.ok) return [];
  const body = await readJsonBody(res);
  const parsed = readDataEnvelope(
    body,
    saleRegistrationItemsSchema,
    `GET /sales/${saleId}/my-registrations`,
  );
  return parsed.items.map((row) => saleRegistrationMineRowSchema.parse(row));
}

/** Masked registered bidder count for social proof (public endpoint). */
export async function getServerSaleBidderCount(saleId: string): Promise<number | null> {
  const base = getServerApiBase();
  const res = await catalogueFetch(
    `${base}/sales/${encodeURIComponent(saleId)}/bidders?limit=1&offset=0`,
    CATALOGUE_FETCH_POLICIES.sales,
  );
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const body = await readJsonBody(res);
  const parsed = readDataEnvelope(body, bidderCountSchema, `GET /sales/${saleId}/bidders`);
  const total = parsed.total;
  return typeof total === "number" && Number.isFinite(total) ? total : null;
}

/** For sitemap / ISR without full Hono client shape. */
export async function fetchSalesForSitemap(): Promise<SitemapSale[]> {
  const base = getServerApiBase();
  const res = await fetch(`${base}/sales?limit=200&offset=0&statuses=scheduled,active,ended`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const body = await readJsonBody(res);
  const { rows } = readNullableListEnvelope(body, sitemapSaleRowSchema, "GET /sales?sitemap");
  return rows;
}
