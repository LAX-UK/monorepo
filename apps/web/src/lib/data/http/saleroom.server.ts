import "server-only";

import { getServerApiBase } from "@/lib/data/http/hc-server";
import { parseSale } from "@/lib/data/http/parse";
import type { Sale } from "@auction/types";
import { cookies } from "next/headers";

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

export type BidderRow = {
  maskedName: string;
  firstBidAt: Date;
};

export type SaleBiddersPage = {
  items: BidderRow[];
  total: number;
  limit: number;
  offset: number;
};

export type GetSaleBiddersParams = {
  id: string;
  page?: number;
  pageSize?: number;
};

export async function getServerSaleBidders(
  params: GetSaleBiddersParams,
): Promise<SaleBiddersPage | null> {
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const base = getServerApiBase();
  const url = `${base}/sales/${encodeURIComponent(params.id)}/bidders?limit=${pageSize}&offset=${offset}`;
  const res = await fetch(url, await authedInit({ cache: "no-store" }));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale bidders: ${res.status}`);
  const body = (await res.json()) as {
    data: {
      items: { maskedName: string; firstBidAt: string }[];
      total: number;
      limit: number;
      offset: number;
    };
  };
  return {
    items: body.data.items.map((i) => ({
      maskedName: i.maskedName,
      firstBidAt: new Date(i.firstBidAt),
    })),
    total: body.data.total,
    limit: body.data.limit,
    offset: body.data.offset,
  };
}

/**
 * Returns `isFollowing` for the current viewer (anonymous callers always get `false`).
 * SSR only reads this for authenticated users (see page orchestrator).
 */
export async function getServerSaleFollowState(id: string): Promise<{ isFollowing: boolean }> {
  const base = getServerApiBase();
  const url = `${base}/sales/${encodeURIComponent(id)}/follow`;
  const res = await fetch(url, await authedInit({ cache: "no-store" }));
  if (!res.ok) return { isFollowing: false };
  const body = (await res.json()) as { data: { isFollowing: boolean } };
  return { isFollowing: Boolean(body.data.isFollowing) };
}

export type RelatedSale = {
  sale: Sale;
  lotCount: number;
};

export type GetRelatedSalesParams = {
  id: string;
  categoryId?: string | null;
  limit?: number;
};

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
  const body = (await res.json()) as { data: { sale: unknown; lots: unknown[] }[] };
  return body.data
    .map((row) => ({ sale: parseSale(row.sale), lotCount: row.lots.length }))
    .filter((row) => row.sale.id !== params.id)
    .slice(0, limit);
}
