import "server-only";

import {
  HOME_CATALOG_FETCH_LIMIT,
  HOME_ENDING_SOON_LIMIT,
  HOME_LIVE_NOW_LIMIT,
  HOME_MORE_LOTS_LIMIT,
  HOME_UPCOMING_LIMIT,
} from "@/components/sections/home/get-home-data.constants";
import {
  buildHomeCatalogLotPool,
  pickHomeMoreLots,
} from "@/components/sections/home/get-home-data.lot-pool";
import type {
  HomeJsonLdListEntry,
  HomePageData,
  HomeUrgencySection,
} from "@/components/sections/home/get-home-data.types";
import { lotsEndingSoon, nextUpcomingLots } from "@/components/sections/home/home-urgency-helpers";
import {
  type LotCardVM,
  toEditorsPickLotCardVMs,
  toEndingSoonLotCardVMs,
  toHomeUpcomingAuctionTileVMs,
} from "@/components/sections/home/home-view-models";
import {
  CATALOGUE_FETCH_POLICIES,
  buildLotListQuery,
  catalogueFetch,
} from "@/lib/catalog/catalog.server";
import type { ListLotsParams } from "@/lib/data/contracts";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { parseLot } from "@/lib/data/http/parse";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerWatchedLotIdSet } from "@/lib/data/http/watchlist.server";
import { resolveHomeHeroState } from "@/lib/home-hero-policy";
import { type SaleListRow, parseSaleListRowApiPayload } from "@/lib/sale-list-row";
import { lotPath } from "@/lib/seo/url";
import type { Lot, Sale } from "@auction/types";
import { cache } from "react";

export {
  HOME_CATALOG_FETCH_LIMIT,
  HOME_ENDING_SOON_LIMIT,
  HOME_LIVE_NOW_LIMIT,
  HOME_MORE_LOTS_LIMIT,
  HOME_UPCOMING_LIMIT,
} from "@/components/sections/home/get-home-data.constants";
export type {
  HomeJsonLdListEntry,
  HomePageData,
  HomeUrgencySection,
} from "@/components/sections/home/get-home-data.types";

type HomeSaleListQuery = {
  status?: Sale["status"];
  statuses?: Sale["status"][];
  categoryId?: string;
  limit?: number;
  offset?: number;
  sort?: "createdDesc" | "startAsc";
};

function jsonLdListEntriesFromLots(lots: Lot[]): HomeJsonLdListEntry[] {
  return lots.map((lot) => ({ title: lot.title, href: lotPath(lot) }));
}

function jsonLdListEntriesFromLotCardVMs(vms: LotCardVM[]): HomeJsonLdListEntry[] {
  return vms.map((l) => ({ title: l.title, href: l.href }));
}

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

async function fetchHomeLots(params: ListLotsParams): Promise<Lot[]> {
  const qs = new URLSearchParams(buildLotListQuery(params));
  const res = await catalogueFetch(
    `${getServerApiBase()}/lots?${qs.toString()}`,
    CATALOGUE_FETCH_POLICIES.home,
  );
  if (!res.ok) throw new Error(`Failed to list home lots: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseLot);
}

async function fetchHomeSales(params: HomeSaleListQuery = {}): Promise<SaleListRow[]> {
  const qs = new URLSearchParams(buildHomeSalesQuery(params));
  const res = await catalogueFetch(
    `${getServerApiBase()}/sales?${qs.toString()}`,
    CATALOGUE_FETCH_POLICIES.home,
  );
  if (!res.ok) throw new Error(`Failed to list home sales: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseSaleListRowApiPayload);
}

function liveNowLots(lots: Lot[]): Lot[] {
  const active = lots.filter((l) => l.status === "active");
  active.sort((a, b) => {
    const ea = a.endTime instanceof Date ? a.endTime.getTime() : Date.parse(String(a.endTime));
    const eb = b.endTime instanceof Date ? b.endTime.getTime() : Date.parse(String(b.endTime));
    return ea - eb;
  });
  return active.slice(0, HOME_LIVE_NOW_LIMIT);
}

function buildUrgencySection(
  activeLots: Lot[],
  endingSoon: Lot[],
  scheduledLots: Lot[],
): HomeUrgencySection {
  if (endingSoon.length > 0) {
    return {
      variant: "endingSoon",
      lots: toEndingSoonLotCardVMs(endingSoon.slice(0, HOME_ENDING_SOON_LIMIT)),
    };
  }
  const live = liveNowLots(activeLots);
  if (live.length > 0) {
    return {
      variant: "liveNow",
      lots: toEndingSoonLotCardVMs(live),
    };
  }
  const upcomingLots = nextUpcomingLots(scheduledLots, HOME_ENDING_SOON_LIMIT);
  if (upcomingLots.length > 0) {
    return {
      variant: "upcoming",
      lots: toEndingSoonLotCardVMs(upcomingLots),
    };
  }
  return { variant: "none", lots: [] };
}

function buildMoreLots(
  activeLots: Lot[],
  scheduledLots: Lot[],
  urgencySection: HomeUrgencySection,
) {
  const picked = pickHomeMoreLots({
    pool: buildHomeCatalogLotPool(activeLots, scheduledLots),
    shownLotIds: new Set(urgencySection.lots.map((vm) => vm.id)),
    limit: HOME_MORE_LOTS_LIMIT,
  });
  return toEditorsPickLotCardVMs(picked);
}

export const getHomeData = cache(async (): Promise<HomePageData> => {
  const [session, watchedSet] = await Promise.all([
    getServerSessionUser(),
    getServerWatchedLotIdSet(),
  ]);
  const isAuthenticated = Boolean(session);
  const watchedLotIds = Array.from(watchedSet);

  let activeLots: Lot[] = [];
  let scheduledLots: Lot[] = [];
  let salesRows: SaleListRow[] = [];
  try {
    const filtered: ListLotsParams = {
      limit: HOME_CATALOG_FETCH_LIMIT,
      status: "active",
      sort: "endingAsc",
    };
    const [activeFetched, scheduled] = await Promise.all([
      fetchHomeLots(filtered),
      fetchHomeLots({ limit: HOME_CATALOG_FETCH_LIMIT, status: "scheduled" }),
    ]);
    scheduledLots = scheduled;
    activeLots = activeFetched;
    salesRows = await fetchHomeSales({
      statuses: ["scheduled", "active"],
      sort: "startAsc",
      limit: 12,
    });
  } catch (err) {
    console.error("[getHomeData] data load failed", err);
  }

  const endingSoon = lotsEndingSoon(activeLots);
  const urgencySection = buildUrgencySection(activeLots, endingSoon, scheduledLots);
  const urgencyLotIds = new Set(urgencySection.lots.map((vm) => vm.id));
  const upcomingAfterUrgency = activeLots.filter((l) => !urgencyLotIds.has(l.id));
  const jsonLdListFallback =
    urgencySection.variant === "upcoming" && urgencySection.lots.length > 0
      ? jsonLdListEntriesFromLotCardVMs(urgencySection.lots)
      : jsonLdListEntriesFromLots(upcomingAfterUrgency.slice(0, HOME_UPCOMING_LIMIT));

  const upcomingSales = salesRows.slice(0, HOME_UPCOMING_LIMIT).map((r) => r.sale);
  const upcomingAuctionTiles = toHomeUpcomingAuctionTileVMs(salesRows).slice(
    0,
    HOME_UPCOMING_LIMIT,
  );

  const heroState = resolveHomeHeroState(salesRows.map((row) => row.sale));
  const moreLots = buildMoreLots(activeLots, scheduledLots, urgencySection);

  return {
    heroState,
    jsonLdListFallback,
    urgencySection,
    upcomingAuctionTiles,
    upcomingSales,
    moreLots,
    isAuthenticated,
    watchedLotIds,
  };
});
