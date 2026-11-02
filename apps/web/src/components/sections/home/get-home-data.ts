import "server-only";

import { getHomeCover, neutralHomeCover } from "@/components/sections/home/get-home-cover";
import {
  allocateHomePageLots,
  homePinnedSaleIds,
} from "@/components/sections/home/get-home-data.lot-pool";
import type {
  HomeJsonLdListEntry,
  HomePageData,
} from "@/components/sections/home/get-home-data.types";
import { getHomeExtras } from "@/components/sections/home/get-home-extras";
import { getHomeHangSales } from "@/components/sections/home/get-home-hang";
import { fetchHomeSales } from "@/components/sections/home/home-fetchers";
import { cachedResolveArtistNames } from "@/lib/data/artist-names.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerWatchedLotIdSet } from "@/lib/data/http/watchlist.server";
import { buildHomeHang, hangSaleIds, planHomeHang } from "@/lib/hang/home-hang";
import { buildLiveNow } from "@/lib/hang/live-now";
import { buildHomeSections } from "@/lib/home-sections/build-home-sections";
import { HOME_SECTION_LIMITS } from "@/lib/home-sections/limits";
import { catalogueOrder, soldOrder } from "@/lib/home-sections/lot-order";
import { coverSaleIds } from "@/lib/marketing-cover/home-cover";
import type { SaleListRow } from "@/lib/sale-list-row";
import { liveTabSaleIds, resolveHomeState } from "@auction/domain";
import { HANG_MAX_WORKS } from "@auction/marketing-ui";
import type { Lot } from "@auction/types";
import { cache } from "react";

export { HOME_UPCOMING_LIMIT } from "@/components/sections/home/get-home-data.constants";
export type {
  HomeJsonLdListEntry,
  HomePageData,
} from "@/components/sections/home/get-home-data.types";

import { HOME_UPCOMING_LIMIT } from "@/components/sections/home/get-home-data.constants";

/** Lots a home section may show: on sale, coming up or sold. Withdrawn and draft lots never. */
const HOME_LOT_STATUSES: ReadonlySet<Lot["status"]> = new Set(["active", "scheduled", "ended"]);

function showable(lots: readonly Lot[] | undefined): Lot[] {
  return (lots ?? []).filter((lot) => HOME_LOT_STATUSES.has(lot.status));
}

/** The lead sale's lots in the order its rail reads, for the sections that have a rail. */
function railCandidates(
  state: { state: string; sections: readonly string[] },
  lots: readonly Lot[],
  featuredLotIds: readonly string[],
): Lot[] {
  if (state.sections.includes("topLotsOfSale")) return soldOrder(lots);
  if (state.sections.includes("inThisSale") || state.sections.includes("highlightsFromNextSale")) {
    return catalogueOrder(lots, featuredLotIds);
  }
  return [];
}

export const getHomeData = cache(async (): Promise<HomePageData> => {
  const [session, watchedSet] = await Promise.all([
    getServerSessionUser(),
    getServerWatchedLotIdSet(),
  ]);
  const isAuthenticated = Boolean(session);
  const watchedLotIds = Array.from(watchedSet);

  let salesRows: SaleListRow[] = [];
  let endedRows: SaleListRow[] = [];
  let salesLoaded = true;
  try {
    salesRows = await fetchHomeSales({
      statuses: ["scheduled", "active"],
      sort: "startAsc",
      limit: 12,
    });
  } catch (err) {
    salesLoaded = false;
    console.error("[getHomeData] data load failed", err);
  }
  try {
    endedRows = await fetchHomeSales({ status: "ended", sort: "endDesc", limit: 12 });
  } catch (err) {
    console.error("[getHomeData] ended sales load failed", err);
  }

  const rows = [...salesRows, ...endedRows];
  const allSales = rows.map((row) => row.sale);
  const homeState = resolveHomeState({
    sales: allSales,
    now: new Date(),
    pinnedSaleIds: homePinnedSaleIds(allSales),
  });
  const leadSale = allSales.find((sale) => sale.id === homeState.leadSaleId);
  const now = new Date();

  const resultsSaleId = homeState.sections.includes("recentResults")
    ? homeState.resultsBandSaleIds[0]
    : undefined;
  const loaded = await getHomeHangSales(
    [
      ...new Set([
        ...coverSaleIds(homeState, allSales),
        ...hangSaleIds(homeState),
        ...liveTabSaleIds(homeState.liveSaleIds, homeState.leadSaleId),
        ...(resultsSaleId ? [resultsSaleId] : []),
      ]),
    ],
    rows,
  );
  const lotsBySale = new Map(loaded.map((entry) => [entry.sale.id, showable(entry.lots)]));
  const hangPlan = planHomeHang(homeState, loaded);
  // A failed read must not look like a quiet season: the cover then says nothing about any sale.
  const cover = salesLoaded
    ? await getHomeCover({ state: homeState, sales: rows, lotsBySale, now })
    : neutralHomeCover();

  const allocated = allocateHomePageLots({
    heroLots: cover.lots,
    hangLots: hangPlan?.candidates ?? [],
    hangLimit: HANG_MAX_WORKS,
    railLots: railCandidates(
      homeState,
      homeState.leadSaleId ? (lotsBySale.get(homeState.leadSaleId) ?? []) : [],
      leadSale?.featuredLotIds ?? [],
    ),
    railLimit: HOME_SECTION_LIMITS.lotRail.max,
    railMin: HOME_SECTION_LIMITS.lotRail.min,
    railRow: HOME_SECTION_LIMITS.lotRail.row,
    resultsLots: soldOrder(resultsSaleId ? (lotsBySale.get(resultsSaleId) ?? []) : []),
    resultsLimit: HOME_SECTION_LIMITS.resultsLots.max,
    resultsMin: HOME_SECTION_LIMITS.resultsLots.min,
  });
  const hang = buildHomeHang(hangPlan, allocated.hang, now);
  const liveNow = buildLiveNow(
    homeState,
    loaded,
    hang,
    new Set(cover.lots.map((lot) => lot.id)),
    now,
  );

  const extras = await getHomeExtras(homeState.sections);
  const summary = rows.find((row) => row.sale.id === resultsSaleId)?.resultsSummary;
  const topLot = summary?.state === "final" ? summary.topLot : null;
  const topLotArtistId = topLot
    ? lotsBySale.get(resultsSaleId ?? "")?.find((lot) => lot.id === topLot.lotId)?.artistId
    : undefined;
  const artistNames = await cachedResolveArtistNames([
    ...allocated.rail.map((lot) => lot.artistId),
    ...allocated.results.map((lot) => lot.artistId),
    topLotArtistId,
  ]);

  const sections = buildHomeSections({
    state: homeState,
    now,
    rows,
    lotsBySale,
    placed: { rail: allocated.rail, results: allocated.results },
    artistNames,
    ...extras,
  });

  const rail = sections.inThisSale ?? sections.highlightsFromNextSale ?? sections.topLotsOfSale;
  const jsonLdListFallback: HomeJsonLdListEntry[] =
    rail?.lots.map((lot) => ({ title: lot.title, href: lot.href })) ?? [];
  const upcomingSales = salesRows.slice(0, HOME_UPCOMING_LIMIT).map((row) => row.sale);

  return {
    homeState,
    hang,
    liveNow,
    cover,
    sections,
    jsonLdListFallback,
    upcomingSales,
    isAuthenticated,
    watchedLotIds,
  };
});
