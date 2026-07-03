import "server-only";

import type { IPressArchiveReader, ListPressArchiveParams } from "@/lib/data/contracts";
import { CATALOGUE_FETCH_POLICIES, catalogueFetch } from "@/lib/data/http/catalogue-fetch";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import {
  parsePressArchiveListResponse,
  parsePressDayMediaSalesResponse,
  parsePressSitemapFreshnessResponse,
} from "@/lib/data/http/parse-press-archive";
import type { PressHubMeta } from "@auction/types";
import { cache } from "react";

const EMPTY_META: PressHubMeta = {
  total: 0,
  archiveTotal: 0,
  outletCount: 0,
  lastUpdated: null,
  availableYears: [],
};

const UNAVAILABLE_COVERAGE = {
  data: [],
  meta: EMPTY_META,
  unavailable: true as const,
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

async function fetchPressCatalogue<T>(
  resource: string,
  path: string,
  parse: (body: unknown) => T,
  fallback: T,
  query = "",
): Promise<T> {
  try {
    const url = `${getServerApiBase()}${path}${query}`;
    const res = await catalogueFetch(url, CATALOGUE_FETCH_POLICIES.press);
    if (!res.ok) {
      console.error(`[press] Failed to load ${resource}:`, res.status, url);
      return fallback;
    }
    return parse(await res.json());
  } catch (error) {
    console.error(`[press] Failed to load ${resource}:`, error);
    return fallback;
  }
}

async function fetchPressCoverage(params: ListPressArchiveParams = {}) {
  return fetchPressCatalogue(
    "coverage",
    "/press/coverage",
    (body) =>
      parsePressArchiveListResponse(body as Parameters<typeof parsePressArchiveListResponse>[0]),
    UNAVAILABLE_COVERAGE,
    buildPressQuery(params),
  );
}

async function fetchPressDayMedia(limit = 24) {
  return fetchPressCatalogue(
    "day media",
    "/press/day-media",
    (body) =>
      parsePressDayMediaSalesResponse(
        body as Parameters<typeof parsePressDayMediaSalesResponse>[0],
      ),
    [],
    `?limit=${limit}`,
  );
}

async function fetchPressSitemapFreshness() {
  return fetchPressCatalogue(
    "sitemap freshness",
    "/press/sitemap-freshness",
    (body) =>
      parsePressSitemapFreshnessResponse(
        body as Parameters<typeof parsePressSitemapFreshnessResponse>[0],
      ),
    [],
  );
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

export async function fetchPressHubMeta(): Promise<PressHubMeta> {
  const { meta } = await fetchPressCoverage({ limit: 1, offset: 0 });
  return meta;
}
