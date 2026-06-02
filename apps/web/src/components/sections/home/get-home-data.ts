import "server-only";

import {
  HOME_CATALOG_FETCH_LIMIT,
  HOME_EDITORS_PICKS_LIMIT,
  HOME_ENDING_SOON_LIMIT,
  HOME_LIVE_NOW_LIMIT,
  HOME_PRIVATE_HIGHLIGHTS_LIMIT,
  HOME_UPCOMING_LIMIT,
} from "@/components/sections/home/get-home-data.constants";
import {
  buildHomeCatalogLotPool,
  pickHomeLowerStripCandidates,
  pickPrivateSaleHighlightLots,
} from "@/components/sections/home/get-home-data.lot-pool";
import type {
  HomeJsonLdListEntry,
  HomePageData,
  HomeUrgencySection,
} from "@/components/sections/home/get-home-data.types";
import { lotsEndingSoon, nextUpcomingLots } from "@/components/sections/home/home-urgency-helpers";
import {
  type HeroLotVM,
  type HeroStateVM,
  type LotCardVM,
  createHeroFallbackVm,
  toEditorsPickLotCardVMs,
  toEndingSoonLotCardVMs,
  toHeroLotVM,
  toHeroSaleSlideVM,
  toHomeUpcomingAuctionTileVMs,
  toPrivateSaleHighlightVMs,
} from "@/components/sections/home/home-view-models";
import type { ListLotsParams } from "@/lib/data/contracts";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { buildLotListQuery } from "@/lib/data/http/lots.server";
import { parseLot, parseSale } from "@/lib/data/http/parse";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerWatchedLotIdSet } from "@/lib/data/http/watchlist.server";
import { getSaleDeliveryModeLabel } from "@/lib/sale-type-presentation";
import { lotPath, salePath } from "@/lib/seo/url";
import type { Lot, Sale } from "@auction/types";
import { parseStreamEmbedUrl } from "@auction/validators";
import { cache } from "react";

export {
  HOME_CATALOG_FETCH_LIMIT,
  HOME_EDITORS_PICKS_LIMIT,
  HOME_ENDING_SOON_LIMIT,
  HOME_LIVE_NOW_LIMIT,
  HOME_PRIVATE_HIGHLIGHTS_LIMIT,
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

type HomeSaleListRow = { sale: Sale; lots: Lot[] };

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
  const res = await fetch(`${getServerApiBase()}/lots?${qs.toString()}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Failed to list home lots: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseLot);
}

async function fetchHomeSales(params: HomeSaleListQuery = {}): Promise<HomeSaleListRow[]> {
  const qs = new URLSearchParams(buildHomeSalesQuery(params));
  const res = await fetch(`${getServerApiBase()}/sales?${qs.toString()}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Failed to list home sales: ${res.status}`);
  const body = (await res.json()) as { data: { sale: unknown; lots: unknown[] }[] };
  return body.data.map((row) => ({
    sale: parseSale(row.sale),
    lots: row.lots.map(parseLot),
  }));
}

function liveNowLots(lots: Lot[], excludeLotId: string | null): Lot[] {
  const active = lots.filter(
    (l) => l.status === "active" && (!excludeLotId || l.id !== excludeLotId),
  );
  active.sort((a, b) => {
    const ea = a.endTime instanceof Date ? a.endTime.getTime() : Date.parse(String(a.endTime));
    const eb = b.endTime instanceof Date ? b.endTime.getTime() : Date.parse(String(b.endTime));
    return ea - eb;
  });
  return active.slice(0, HOME_LIVE_NOW_LIMIT);
}

function buildUrgencySection(
  upcoming: Lot[],
  featuredLot: Lot | null,
  endingSoonWithoutHero: Lot[],
  scheduledLots: Lot[],
): HomeUrgencySection {
  if (endingSoonWithoutHero.length > 0) {
    return {
      variant: "endingSoon",
      lots: toEndingSoonLotCardVMs(endingSoonWithoutHero.slice(0, HOME_ENDING_SOON_LIMIT)),
    };
  }
  const live = liveNowLots(upcoming, featuredLot?.id ?? null);
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

async function resolveHomeHeroState(heroVm: HeroLotVM): Promise<HeroStateVM> {
  try {
    const activeRows = await fetchHomeSales({ status: "active", limit: 10 });
    for (const row of activeRows) {
      const { sale } = row;
      if (sale.deliveryMode !== "onsite") continue;
      if (!sale.streamUrl) continue;
      const embed = parseStreamEmbedUrl(sale.streamUrl);
      if (!embed) continue;
      const modeLabel = getSaleDeliveryModeLabel("onsite");
      return {
        kind: "live",
        saleId: sale.id,
        saleTitle: sale.title,
        embedSrc: embed.src,
        provider: embed.provider,
        modeLabel,
        saleroomHref: salePath(sale),
        ...(embed.provider === "youtube" && embed.videoId
          ? {
              videoId: embed.videoId,
              ...(embed.startSeconds !== undefined ? { startSeconds: embed.startSeconds } : {}),
            }
          : {}),
        posterImageUrl: sale.coverImages[0] ?? null,
      };
    }

    const rotatorRows = await fetchHomeSales({
      statuses: ["scheduled", "active"],
      sort: "startAsc",
      limit: 5,
    });
    if (rotatorRows.length > 0) {
      return {
        kind: "rotator",
        slides: rotatorRows.map((r) => toHeroSaleSlideVM(r.sale)),
      };
    }
  } catch (err) {
    console.error("[getHomeData] hero sale load failed", err);
  }

  return { kind: "fallbackLot", lot: heroVm };
}

function buildLowerStripLots(
  activeLots: Lot[],
  scheduledLots: Lot[],
  heroState: HeroStateVM,
  urgencySection: HomeUrgencySection,
) {
  const catalogPool = buildHomeCatalogLotPool(activeLots, scheduledLots);
  const candidates = pickHomeLowerStripCandidates({
    pool: catalogPool,
    heroState,
    urgencySection,
  });

  return {
    editorsPickLots: toEditorsPickLotCardVMs(candidates.slice(0, HOME_EDITORS_PICKS_LIMIT)),
    privateSaleHighlights: toPrivateSaleHighlightVMs(
      pickPrivateSaleHighlightLots(candidates).slice(0, HOME_PRIVATE_HIGHLIGHTS_LIMIT),
    ),
  };
}

export const getHomeData = cache(async (): Promise<HomePageData> => {
  const [session, watchedSet] = await Promise.all([
    getServerSessionUser(),
    getServerWatchedLotIdSet(),
  ]);
  const isAuthenticated = Boolean(session);
  const watchedLotIds = Array.from(watchedSet);

  let upcoming: Lot[] = [];
  let scheduledLots: Lot[] = [];
  let salesRows: HomeSaleListRow[] = [];
  try {
    const filtered: ListLotsParams = {
      limit: HOME_CATALOG_FETCH_LIMIT,
      status: "active",
      sort: "endingAsc",
    };
    const [activeLots, scheduled] = await Promise.all([
      fetchHomeLots(filtered),
      fetchHomeLots({ limit: HOME_CATALOG_FETCH_LIMIT, status: "scheduled" }),
    ]);
    scheduledLots = scheduled;
    upcoming = activeLots;
    if (upcoming.length === 0) {
      upcoming = await fetchHomeLots({ limit: HOME_CATALOG_FETCH_LIMIT, sort: "endingAsc" });
    }
    salesRows = await fetchHomeSales({
      statuses: ["scheduled", "active"],
      sort: "startAsc",
      limit: 12,
    });
  } catch (err) {
    console.error("[getHomeData] data load failed", err);
  }

  const featuredLot = upcoming[0] ?? null;
  const firstSale = salesRows[0] ?? null;
  const saleTitleForHero =
    featuredLot && firstSale && featuredLot.saleId === firstSale.sale.id
      ? firstSale.sale.title
      : (firstSale?.sale.title ?? null);

  const heroVm: HeroLotVM = featuredLot
    ? toHeroLotVM(featuredLot, saleTitleForHero, { saleId: featuredLot.saleId ?? null })
    : createHeroFallbackVm();
  const endingSoon = lotsEndingSoon(upcoming);
  const endingSoonWithoutHero = featuredLot
    ? endingSoon.filter((l) => l.id !== featuredLot.id)
    : endingSoon;
  const endingSoonRowIds = new Set(
    endingSoonWithoutHero.slice(0, HOME_ENDING_SOON_LIMIT).map((l) => l.id),
  );
  const upcomingAfterHero = upcoming.filter(
    (l) => l.id !== featuredLot?.id && !endingSoonRowIds.has(l.id),
  );
  const urgencySection = buildUrgencySection(
    upcoming,
    featuredLot,
    endingSoonWithoutHero,
    scheduledLots,
  );
  const jsonLdListFallback =
    urgencySection.variant === "upcoming" && urgencySection.lots.length > 0
      ? jsonLdListEntriesFromLotCardVMs(urgencySection.lots)
      : jsonLdListEntriesFromLots(upcomingAfterHero.slice(0, HOME_UPCOMING_LIMIT));

  const upcomingSales = salesRows.slice(0, HOME_UPCOMING_LIMIT).map((r) => r.sale);
  const upcomingAuctionTiles = toHomeUpcomingAuctionTileVMs(salesRows).slice(
    0,
    HOME_UPCOMING_LIMIT,
  );

  const heroState = await resolveHomeHeroState(heroVm);
  const { editorsPickLots, privateSaleHighlights } = buildLowerStripLots(
    upcoming,
    scheduledLots,
    heroState,
    urgencySection,
  );

  return {
    heroState,
    jsonLdListFallback,
    urgencySection,
    upcomingAuctionTiles,
    upcomingSales,
    editorsPickLots,
    privateSaleHighlights,
    isAuthenticated,
    watchedLotIds,
  };
});
