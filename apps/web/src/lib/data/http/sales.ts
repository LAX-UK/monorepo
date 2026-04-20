import { getBrowserHc } from "@/lib/data/http/hc-browser";
import { parseLot, parseSale } from "@/lib/data/http/parse";
import type { Sale } from "@auction/types";
import type { ListSalesQuery, SaleListRow, SaleWithLots } from "./sales.server";

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

export async function fetchSalesListClient(params: ListSalesQuery = {}): Promise<SaleListRow[]> {
  const client = getBrowserHc();
  const res = await client.sales.$get({ query: buildSalesQuery(params) });
  if (!res.ok) throw new Error(`Failed to list sales: ${res.status}`);
  const body = (await res.json()) as { data: { sale: unknown; lots: unknown[] }[] };
  return body.data.map((row) => ({
    sale: parseSale(row.sale),
    lots: row.lots.map(parseLot),
  }));
}

export async function fetchSaleWithLotsClient(id: string): Promise<SaleWithLots | null> {
  const client = getBrowserHc();
  const res = await client.sales[":id"].$get({ param: { id } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale: ${res.status}`);
  const body = (await res.json()) as { data: { sale: unknown; lots: unknown[] } };
  return {
    sale: parseSale(body.data.sale),
    lots: body.data.lots.map(parseLot),
  };
}
