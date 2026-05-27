import "server-only";
import { throwIfNotOk } from "@/lib/dashboard/dashboard-fetch-errors";
import type {
  ArchiveEndedSummary,
  ArchiveMetricsReader,
  ListLotsParams,
  LotReader,
} from "@/lib/data/contracts";
import { getServerApiBase, getServerHc } from "@/lib/data/http/hc-server";
import { parseBid, parseLot } from "@/lib/data/http/parse";
import type { LotDocumentPublicRow } from "@/lib/data/lot-documents-public";
import type { Bid, Lot } from "@auction/types";
import { cache } from "react";

export function buildLotListQuery(params: ListLotsParams): Record<string, string> {
  const q: Record<string, string> = {
    limit: String(params.limit ?? 20),
    offset: String(params.offset ?? 0),
  };
  if (params.status) q.status = params.status;
  if (params.categoryId) q.categoryId = params.categoryId;
  if (params.sellerId) q.sellerId = params.sellerId;
  if (params.winnerId) q.winnerId = params.winnerId;
  if (params.saleId) q.saleId = params.saleId;
  if (params.artistId) q.artistId = params.artistId;
  if (params.endYear !== undefined) q.endYear = String(params.endYear);
  if (params.sort) q.sort = params.sort;
  if (params.q?.trim()) q.q = params.q.trim();
  return q;
}

/** Initial bid history for artwork SSR (no auth). Deduped per request via React cache. */
export const getServerLotBids = cache(async (lotId: string, limit = 50): Promise<Bid[]> => {
  const client = await getServerHc();
  const res = await client.lots[":id"].bids.$get({
    param: { id: lotId },
    query: { limit: String(limit) },
  });
  if (!res.ok) {
    throw new Error(`Failed to load bids: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseBid);
});

export async function getServerArchiveMetricsReader(): Promise<ArchiveMetricsReader> {
  const base = getServerApiBase();
  return {
    async getEndedSummary(endYear?: number): Promise<ArchiveEndedSummary> {
      const qs = new URLSearchParams();
      if (endYear !== undefined) qs.set("endYear", String(endYear));
      const suffix = qs.toString();
      const url = `${base}/lots/archive/summary${suffix ? `?${suffix}` : ""}`;
      const res = await fetch(url, { next: { revalidate: 120 } });
      if (!res.ok) {
        throw new Error(`Failed to load archive summary: ${res.status}`);
      }
      const body = (await res.json()) as {
        data: { totalHammer: string; endedLotCount: number };
      };
      return body.data;
    },
    async countEndedLots(filters: {
      categoryId?: string;
      endYear?: number;
    }): Promise<number> {
      const qs = new URLSearchParams();
      if (filters.categoryId) qs.set("categoryId", filters.categoryId);
      if (filters.endYear !== undefined) qs.set("endYear", String(filters.endYear));
      const url = `${base}/lots/archive/count?${qs.toString()}`;
      const res = await fetch(url, { next: { revalidate: 60 } });
      if (!res.ok) {
        throw new Error(`Failed to load archive count: ${res.status}`);
      }
      const body = (await res.json()) as { count: number };
      return body.count;
    },
  };
}

export async function getServerLotReader(): Promise<LotReader> {
  const client = await getServerHc();
  return {
    async list(params: ListLotsParams): Promise<Lot[]> {
      const res = await client.lots.$get({ query: buildLotListQuery(params) });
      await throwIfNotOk(res, "sellerLots");
      const body = (await res.json()) as { data: unknown[] };
      return body.data.map(parseLot);
    },
    async getById(id: string): Promise<Lot | null> {
      const res = await client.lots[":id"].$get({ param: { id } });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`Failed to load lot: ${res.status}`);
      }
      const body = (await res.json()) as { data: unknown };
      return parseLot(body.data);
    },
  };
}

export const getServerLotById = cache(async function getServerLotById(
  id: string,
): Promise<Lot | null> {
  const reader = await getServerLotReader();
  return reader.getById(id);
});

export type { LotDocumentPublicRow } from "@/lib/data/lot-documents-public";

function parseLotDocumentPublicRow(raw: unknown): LotDocumentPublicRow {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? ""),
    kind: String(o.kind ?? ""),
    label: o.label == null ? null : String(o.label),
    downloadUrl: String(o.downloadUrl ?? ""),
  };
}

/** Public lot attachments; returns empty on error or non-catalogue lots. */
export async function getServerLotDocuments(lotId: string): Promise<LotDocumentPublicRow[]> {
  const base = getServerApiBase();
  const res = await fetch(`${base}/lots/${encodeURIComponent(lotId)}/documents`, {
    next: { revalidate: 120 },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseLotDocumentPublicRow);
}
