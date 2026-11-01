import "server-only";

import {
  CATALOGUE_FETCH_POLICIES,
  buildLotListQuery,
  catalogueFetch,
} from "@/lib/catalog/catalog.server";
import type { ListLotsParams } from "@/lib/data/contracts";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { parseLot } from "@/lib/data/http/parse";
import { type SaleListRow, parseSaleListRowApiPayload } from "@/lib/sale-list-row";
import type { Lot, Sale } from "@auction/types";

export type HomeSaleListQuery = {
  status?: Sale["status"];
  statuses?: Sale["status"][];
  categoryId?: string;
  limit?: number;
  offset?: number;
  sort?: "createdDesc" | "startAsc";
};

function buildHomeSalesQuery(params: HomeSaleListQuery): Record<string, string> {
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

export async function fetchHomeLots(params: ListLotsParams): Promise<Lot[]> {
  const qs = new URLSearchParams(buildLotListQuery(params));
  const res = await catalogueFetch(
    `${getServerApiBase()}/lots?${qs.toString()}`,
    CATALOGUE_FETCH_POLICIES.home,
  );
  if (!res.ok) throw new Error(`Failed to list home lots: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseLot);
}

export async function fetchHomeSales(params: HomeSaleListQuery = {}): Promise<SaleListRow[]> {
  const qs = new URLSearchParams(buildHomeSalesQuery(params));
  const res = await catalogueFetch(
    `${getServerApiBase()}/sales?${qs.toString()}`,
    CATALOGUE_FETCH_POLICIES.home,
  );
  if (!res.ok) throw new Error(`Failed to list home sales: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseSaleListRowApiPayload);
}
