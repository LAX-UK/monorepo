import "server-only";

import type { IPressArchiveReader, ListPressArchiveParams } from "@/lib/data/contracts";
import { CATALOGUE_FETCH_POLICIES, catalogueFetch } from "@/lib/data/http/catalogue-fetch";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import {
  parsePressArchiveListResponse,
  parsePressDayMediaSalesResponse,
  parsePressSitemapFreshnessResponse,
} from "@/lib/data/http/parse-press-archive";
import { cache } from "react";

const EMPTY_META: import("@auction/types").PressHubMeta = {
  total: 0,
  archiveTotal: 0,
  outletCount: 0,
  lastUpdated: null,
  availableYears: [],
};

function buildPressQuery(params: ListPressArchiveParams = {}): string {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  if (params.year != null) qs.set("year", String(params.year));
  if (params.q) qs.set("q", params.q);
  if (params.mentionType != null) qs.set("mentionType", params.mentionType);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

async function fetchPressCoverage(params: ListPressArchiveParams = {}) {
  const base = getServerApiBase();
  const url = `${base}/press/coverage${buildPressQuery(params)}`;
  const res = await catalogueFetch(url, CATALOGUE_FETCH_POLICIES.press);
  if (!res.ok) {
    console.error("[press] Failed to load coverage:", res.status, url);
    return { data: [], meta: EMPTY_META, unavailable: true as const };
  }
  const body = (await res.json()) as Parameters<typeof parsePressArchiveListResponse>[0];
  return parsePressArchiveListResponse(body);
}

async function fetchPressDayMedia(limit = 24) {
  const base = getServerApiBase();
  const url = `${base}/press/day-media?limit=${limit}`;
  const res = await catalogueFetch(url, CATALOGUE_FETCH_POLICIES.press);
  if (!res.ok) {
    console.error("[press] Failed to load day media:", res.status, url);
    return [];
  }
  const body = (await res.json()) as Parameters<typeof parsePressDayMediaSalesResponse>[0];
  return parsePressDayMediaSalesResponse(body);
}

async function fetchPressSitemapFreshness() {
  const base = getServerApiBase();
  const url = `${base}/press/sitemap-freshness`;
  const res = await catalogueFetch(url, CATALOGUE_FETCH_POLICIES.press);
  if (!res.ok) {
    console.error("[press] Failed to load sitemap freshness:", res.status, url);
    return [];
  }
  const body = (await res.json()) as Parameters<typeof parsePressSitemapFreshnessResponse>[0];
  return parsePressSitemapFreshnessResponse(body);
}

const getCachedPressCoverage = cache((paramsKey: string) => {
  const params = paramsKey ? (JSON.parse(paramsKey) as ListPressArchiveParams) : {};
  return fetchPressCoverage(params);
});

export function getServerPressArchiveReader(): IPressArchiveReader {
  return {
    list(params = {}) {
      return getCachedPressCoverage(JSON.stringify(params));
    },
    listDayMediaSales(limit = 24) {
      return fetchPressDayMedia(limit);
    },
    getSitemapFreshness() {
      return fetchPressSitemapFreshness();
    },
  };
}

export async function fetchPressHubMeta(): Promise<import("@auction/types").PressHubMeta> {
  const { meta } = await fetchPressCoverage({ limit: 1, offset: 0 });
  return meta;
}
