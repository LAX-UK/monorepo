import "server-only";

import { hasAuthSessionCookie } from "@/lib/auth/session-cookie";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { CATALOGUE_FETCH_POLICIES, catalogueFetch } from "@/lib/data/http/catalogue-fetch";
import { getServerApiBase, getServerHc } from "@/lib/data/http/hc-server";
import { parseLot, parseSale } from "@/lib/data/http/parse";
import { NO_STORE_FETCH_POLICY } from "@/lib/data/http/server-fetch-policy";
import { type SaleListRow, parseSaleListRowApiPayload } from "@/lib/sale-list-row";
import type { Lot, Sale } from "@auction/types";
import { cookies } from "next/headers";
import { cache } from "react";

export type ListSalesQuery = {
  status?: Sale["status"];
  statuses?: Sale["status"][];
  categoryId?: string;
  limit?: number;
  offset?: number;
  sort?: "createdDesc" | "startAsc";
};

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

export type { SaleListRow } from "@/lib/sale-list-row";

export async function getServerSalesList(params: ListSalesQuery = {}): Promise<SaleListRow[]> {
  const client = await getServerHc();
  const res = await client.sales.$get({ query: buildSalesQuery(params) });
  if (!res.ok) throw new Error(`Failed to list sales: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseSaleListRowApiPayload);
}

export type SaleViewerState = {
  isFollowing: boolean;
};

export type SaleWithLots = { sale: Sale; lots: Lot[]; viewer?: SaleViewerState };

export type SaleShell = { sale: Sale; viewer?: SaleViewerState };

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
  const body = (await res.json()) as {
    data: { sale: unknown; viewer?: { isFollowing?: boolean } };
  };
  const sale = parseSale(body.data.sale);
  return body.data.viewer
    ? { sale, viewer: { isFollowing: Boolean(body.data.viewer.isFollowing) } }
    : { sale };
});

export const getServerSaleWithLots = cache(async function getServerSaleWithLots(
  id: string,
): Promise<SaleWithLots | null> {
  const client = await getServerHc();
  const res = await client.sales[":id"].$get({ param: { id } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale: ${res.status}`);
  const body = (await res.json()) as {
    data: { sale: unknown; lots: unknown[]; viewer?: { isFollowing?: boolean } };
  };
  const base = {
    sale: parseSale(body.data.sale),
    lots: body.data.lots.map(parseLot),
  };
  return body.data.viewer
    ? { ...base, viewer: { isFollowing: Boolean(body.data.viewer.isFollowing) } }
    : base;
});

export type SaleLotsPage = {
  items: Lot[];
  total: number;
  limit: number;
  offset: number;
  sort: "lot" | "priceAsc" | "priceDesc" | "endingAsc";
};

export type GetSaleLotsPageParams = {
  id: string;
  page?: number;
  pageSize?: number;
  sort?: "lot" | "priceAsc" | "priceDesc" | "endingAsc";
};

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
  const body = (await res.json()) as {
    data: { items: unknown[]; total: number; limit: number; offset: number; sort: string };
  };
  return {
    items: body.data.items.map(parseLot),
    total: body.data.total,
    limit: body.data.limit,
    offset: body.data.offset,
    sort: (body.data.sort as SaleLotsPage["sort"]) ?? "lot",
  };
}

export type SaleRegistrationMineRow = {
  id: string;
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  requestedAt: string;
  bidLimit: string | null;
  rejectionReason: string | null;
  paddleNumber: number | null;
  checkedInAt: string | null;
};

const saleRegistrationStatuses = ["pending", "approved", "rejected", "withdrawn"] as const;

function parseSaleRegistrationMine(raw: unknown): SaleRegistrationMineRow {
  const o = raw as Record<string, unknown>;
  const st = o.status;
  const status =
    typeof st === "string" && (saleRegistrationStatuses as readonly string[]).includes(st)
      ? (st as SaleRegistrationMineRow["status"])
      : "pending";
  return {
    id: String(o.id ?? ""),
    saleId: String(o.saleId ?? ""),
    userId: String(o.userId ?? ""),
    buyerLegalEntityId: String(o.buyerLegalEntityId ?? ""),
    status,
    requestedAt: typeof o.requestedAt === "string" ? o.requestedAt : "",
    bidLimit: o.bidLimit == null ? null : String(o.bidLimit),
    rejectionReason: o.rejectionReason == null ? null : String(o.rejectionReason),
    paddleNumber:
      typeof o.paddleNumber === "number" && Number.isInteger(o.paddleNumber)
        ? o.paddleNumber
        : null,
    checkedInAt: typeof o.checkedInAt === "string" ? o.checkedInAt : null,
  };
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
  const body = (await res.json()) as { data: { items: unknown[] } };
  return body.data.items.map(parseSaleRegistrationMine);
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
  const body = (await res.json()) as { data?: { total?: number } };
  const total = body.data?.total;
  return typeof total === "number" && Number.isFinite(total) ? total : null;
}

export type SitemapSale = { id: string; title: string };

/** For sitemap / ISR without full Hono client shape. */
export async function fetchSalesForSitemap(): Promise<SitemapSale[]> {
  const base = getServerApiBase();
  const res = await fetch(`${base}/sales?limit=200&offset=0&statuses=scheduled,active,ended`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { data: { sale: { id: string; title: string } }[] };
  return body.data
    .map((row) => ({ id: row.sale.id, title: row.sale.title }))
    .filter((sale) => Boolean(sale.id && sale.title));
}
