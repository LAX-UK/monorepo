import "server-only";
import { hasAuthSessionCookie } from "@/lib/auth/session-cookie";
import { throwIfNotOk } from "@/lib/dashboard/dashboard-fetch-errors";
import type {
  ArchiveEndedSummary,
  ArchiveMetricsReader,
  ListLotsParams,
  LotReader,
} from "@/lib/data/contracts";
import { CATALOGUE_FETCH_POLICIES, catalogueFetch } from "@/lib/data/http/catalogue-fetch";
import { createServerHc, getServerApiBase, getServerHc } from "@/lib/data/http/hc-server";
import { parseBid, parseLot } from "@/lib/data/http/parse";
import { NO_STORE_FETCH_POLICY } from "@/lib/data/http/server-fetch-policy";
import type { LotDocumentPublicRow } from "@/lib/data/lot-documents-public";
import type { Bid, Lot } from "@auction/types";
import { cookies } from "next/headers";
import { cache } from "react";

export function buildLotListQuery(params: ListLotsParams): Record<string, string> {
  const q: Record<string, string> = {
    limit: String(params.limit ?? 20),
    offset: String(params.offset ?? 0),
  };
  if (params.status) q.status = params.status;
  if (params.statuses?.length) q.statuses = params.statuses.join(",");
  if (params.categoryId) q.categoryId = params.categoryId;
  if (params.sellerId) q.sellerId = params.sellerId;
  if (params.winnerId) q.winnerId = params.winnerId;
  if (params.saleId) q.saleId = params.saleId;
  if (params.artistId) q.artistId = params.artistId;
  if (params.endYear !== undefined) q.endYear = String(params.endYear);
  if (params.sort) q.sort = params.sort;
  if (params.q?.trim()) q.q = params.q.trim();
  if (params.endingWithinHours !== undefined)
    q.endingWithinHours = String(params.endingWithinHours);
  if (params.needsPhotos) q.needsPhotos = "1";
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

export type LotCountParams = {
  q?: string;
  categoryId?: string;
  status?: string;
  endingWithinHours?: number;
};

/** Exact count of catalogue lots matching the given filters (for numbered pagination). */
export const getServerLotCount = cache(async (params: LotCountParams): Promise<number | null> => {
  try {
    const query: Record<string, string> = {};
    if (params.q?.trim()) query.q = params.q.trim();
    if (params.categoryId) query.categoryId = params.categoryId;
    if (params.status) query.status = params.status;
    if (params.endingWithinHours !== undefined) {
      query.endingWithinHours = String(params.endingWithinHours);
    }
    const cookieHeader = await cookieHeaderString();
    const authed = hasAuthSessionCookie(cookieHeader);
    const qs = new URLSearchParams(query);
    const res = await catalogueFetch(
      `${getServerApiBase()}/lots/count?${qs.toString()}`,
      authed ? NO_STORE_FETCH_POLICY : CATALOGUE_FETCH_POLICIES.lots,
      authed ? { headers: { Cookie: cookieHeader } } : undefined,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { count?: number };
    return typeof body.count === "number" ? body.count : null;
  } catch {
    return null;
  }
});

/** Number of users watching a lot (social proof). Returns 0 on any failure. */
export const getServerLotWatchCount = cache(async (lotId: string): Promise<number> => {
  try {
    const client = await getServerHc();
    const res = await client.lots[":id"]["watch-count"].$get({
      param: { id: lotId },
    });
    if (!res.ok) return 0;
    const body = (await res.json()) as { data?: { count?: number } };
    return typeof body.data?.count === "number" ? body.data.count : 0;
  } catch {
    return 0;
  }
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

async function cookieHeaderString(): Promise<string> {
  const jar = await cookies();
  return jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

async function listLotsViaCatalogueFetch(params: ListLotsParams): Promise<Lot[]> {
  const qs = new URLSearchParams(buildLotListQuery(params));
  const cookieHeader = await cookieHeaderString();
  const authed = hasAuthSessionCookie(cookieHeader);
  const res = await catalogueFetch(
    `${getServerApiBase()}/lots?${qs.toString()}`,
    authed ? NO_STORE_FETCH_POLICY : CATALOGUE_FETCH_POLICIES.lots,
    authed ? { headers: { Cookie: cookieHeader } } : undefined,
  );
  await throwIfNotOk(res, "sellerLots");
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseLot);
}

export async function getServerLotReader(): Promise<LotReader> {
  const client = await createServerHc(NO_STORE_FETCH_POLICY);
  return {
    async list(params: ListLotsParams): Promise<Lot[]> {
      const cookieHeader = await cookieHeaderString();
      if (!hasAuthSessionCookie(cookieHeader)) {
        return listLotsViaCatalogueFetch(params);
      }
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
