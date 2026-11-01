import "server-only";

import {
  HOME_CATALOG_FETCH_LIMIT,
  HOME_ENDING_SOON_LIMIT,
  HOME_LIVE_NOW_LIMIT,
  HOME_MORE_LOTS_LIMIT,
  HOME_UPCOMING_LIMIT,
} from "@/components/sections/home/get-home-data.constants";
import {
  allocateHomePageLots,
  buildHomeCatalogLotPool,
  homePinnedSaleIds,
} from "@/components/sections/home/get-home-data.lot-pool";
import type {
  HomeJsonLdListEntry,
  HomePageData,
  HomeUrgencySection,
} from "@/components/sections/home/get-home-data.types";
import { getHomeHangSales } from "@/components/sections/home/get-home-hang";
import { fetchHomeLots, fetchHomeSales } from "@/components/sections/home/home-fetchers";
import { lotsEndingSoon, nextUpcomingLots } from "@/components/sections/home/home-urgency-helpers";
import {
  type LotCardVM,
  toEditorsPickLotCardVMs,
  toEndingSoonLotCardVMs,
  toHomeUpcomingAuctionTileVMs,
} from "@/components/sections/home/home-view-models";
import type { ListLotsParams } from "@/lib/data/contracts";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerWatchedLotIdSet } from "@/lib/data/http/watchlist.server";
import { buildHomeHang, hangSaleIds, planHomeHang } from "@/lib/hang/home-hang";
import { resolveHomeHeroState } from "@/lib/home-hero-policy";
import type { SaleListRow } from "@/lib/sale-list-row";
import { lotPath } from "@/lib/seo/url";
import { type HomeStateResult, resolveHomeState } from "@auction/domain";
import { HANG_MAX_WORKS } from "@auction/marketing-ui";
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

function jsonLdListEntriesFromLots(lots: Lot[]): HomeJsonLdListEntry[] {
  return lots.map((lot) => ({ title: lot.title, href: lotPath(lot) }));
}

function jsonLdListEntriesFromLotCardVMs(vms: LotCardVM[]): HomeJsonLdListEntry[] {
  return vms.map((l) => ({ title: l.title, href: l.href }));
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

type UrgencyChoice = { variant: HomeUrgencySection["variant"]; lots: Lot[] };

function chooseUrgencyLots(
  activeLots: Lot[],
  endingSoon: Lot[],
  scheduledLots: Lot[],
): UrgencyChoice {
  if (endingSoon.length > 0) {
    return { variant: "endingSoon", lots: endingSoon.slice(0, HOME_ENDING_SOON_LIMIT) };
  }
  const live = liveNowLots(activeLots);
  if (live.length > 0) return { variant: "liveNow", lots: live };
  const upcomingLots = nextUpcomingLots(scheduledLots, HOME_ENDING_SOON_LIMIT);
  if (upcomingLots.length > 0) return { variant: "upcoming", lots: upcomingLots };
  return { variant: "none", lots: [] };
}

/** Today's hero renders live and upcoming sales; the lead sale goes first. */
function heroSalesLeadFirst(sales: Sale[], state: HomeStateResult): Sale[] {
  const offered = sales.filter((sale) => sale.status === "active" || sale.status === "scheduled");
  const lead = offered.find((sale) => sale.id === state.leadSaleId);
  return lead ? [lead, ...offered.filter((s) => s !== lead)] : offered;
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
  let endedRows: SaleListRow[] = [];
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
  try {
    endedRows = await fetchHomeSales({ status: "ended", sort: "endDesc", limit: 12 });
  } catch (err) {
    console.error("[getHomeData] ended sales load failed", err);
  }

  const allSales = [...salesRows, ...endedRows].map((row) => row.sale);
  const homeState = resolveHomeState({
    sales: allSales,
    now: new Date(),
    pinnedSaleIds: homePinnedSaleIds(allSales),
  });
  const leadSale = allSales.find((sale) => sale.id === homeState.leadSaleId);

  const endingSoon = lotsEndingSoon(activeLots);
  const choice = chooseUrgencyLots(activeLots, endingSoon, scheduledLots);
  const now = new Date();
  const hangPlan = planHomeHang(
    homeState,
    await getHomeHangSales(hangSaleIds(homeState), [...salesRows, ...endedRows]),
  );
  const {
    hang: hangLots,
    rail,
    more,
  } = allocateHomePageLots({
    railLots: choice.lots,
    pool: buildHomeCatalogLotPool(activeLots, scheduledLots),
    moreLimit: HOME_MORE_LOTS_LIMIT,
    featuredLotIds: leadSale?.featuredLotIds ?? [],
    hangLots: hangPlan?.candidates ?? [],
    hangLimit: HANG_MAX_WORKS,
  });
  const hang = buildHomeHang(hangPlan, hangLots, now);
  const urgencySection: HomeUrgencySection = {
    // The hang may have taken every lot of the sale; an empty rail is hidden, not shown empty.
    variant: rail.length > 0 ? choice.variant : "none",
    lots: toEndingSoonLotCardVMs(rail),
  };
  const urgencyLotIds = new Set(rail.map((lot) => lot.id));
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

  const heroState = resolveHomeHeroState(heroSalesLeadFirst(allSales, homeState));
  const moreLots = toEditorsPickLotCardVMs(more);

  return {
    homeState,
    hang,
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
