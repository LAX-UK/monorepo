import "server-only";

import { getServerApiBase, getServerHc } from "@/lib/data/http/hc-server";
import { parseLot, parseSale } from "@/lib/data/http/parse";
import type { Lot, Sale } from "@auction/types";

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

export type SaleListRow = { sale: Sale; lots: Lot[] };

export async function getServerSalesList(params: ListSalesQuery = {}): Promise<SaleListRow[]> {
  const client = await getServerHc();
  const res = await client.sales.$get({ query: buildSalesQuery(params) });
  if (!res.ok) throw new Error(`Failed to list sales: ${res.status}`);
  const body = (await res.json()) as { data: { sale: unknown; lots: unknown[] }[] };
  return body.data.map((row) => ({
    sale: parseSale(row.sale),
    lots: row.lots.map(parseLot),
  }));
}

export type SaleWithLots = { sale: Sale; lots: Lot[] };

export async function getServerSaleWithLots(id: string): Promise<SaleWithLots | null> {
  const client = await getServerHc();
  const res = await client.sales[":id"].$get({ param: { id } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale: ${res.status}`);
  const body = (await res.json()) as { data: { sale: unknown; lots: unknown[] } };
  return {
    sale: parseSale(body.data.sale),
    lots: body.data.lots.map(parseLot),
  };
}

/** For sitemap / ISR without full Hono client shape. */
export async function fetchSalesIdsForSitemap(): Promise<string[]> {
  const base = getServerApiBase();
  const res = await fetch(`${base}/sales?limit=200&offset=0`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  const body = (await res.json()) as { data: { sale: { id: string } }[] };
  return body.data.map((row) => row.sale.id);
}
