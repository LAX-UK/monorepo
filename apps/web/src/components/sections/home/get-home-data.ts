import "server-only";

import {
  type EditorsPickLotCardVM,
  type HeroLotVM,
  type HeroStateVM,
  type HomeUpcomingAuctionTileVM,
  type LotCardVM,
  type PrivateSaleHighlightVM,
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
import { lotPath, salePath } from "@/lib/seo/url";
import type { Lot, Sale } from "@auction/types";
import { parseStreamEmbedUrl } from "@auction/validators";
import { cache } from "react";

type HomeSaleListQuery = {
  status?: Sale["status"];
  statuses?: Sale["status"][];
  categoryId?: string;
  limit?: number;
  offset?: number;
  sort?: "createdDesc" | "startAsc";
};

type HomeSaleListRow = { sale: Sale; lots: Lot[] };

/** Minimal shape for `itemList` JSON-LD when there are no upcoming-auction tiles. */
export type HomeJsonLdListEntry = { title: string; href: string };

function jsonLdListEntriesFromLots(lots: Lot[]): HomeJsonLdListEntry[] {
  return lots.map((lot) => ({ title: lot.title, href: lotPath(lot) }));
}

export type HomePageData = {
  heroState: HeroStateVM;
  /** Lots promoted for structured data when `upcomingAuctionTiles` is empty. */
  jsonLdListFallback: HomeJsonLdListEntry[];
  endingSoonLots: LotCardVM[];
  upcomingAuctionTiles: HomeUpcomingAuctionTileVM[];
  editorsPickLots: EditorsPickLotCardVM[];
  privateSaleHighlights: PrivateSaleHighlightVM[];
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

const ENDING_SOON_WINDOW_MS = 100 * 60 * 60 * 1000;

/** Prefer lots past the editor’s-picks window; fall back to the tail so thin
 * catalogues still surface a distinct row when possible. */
function pickPrivateSaleHighlightLots(lots: Lot[]): Lot[] {
  if (lots.length === 0) return [];
  const fromOffset = lots.slice(12, 15);
  if (fromOffset.length > 0) return fromOffset;
  return lots.slice(-Math.min(3, lots.length));
}

function lotsEndingSoon(lots: Lot[]): Lot[] {
  const now = Date.now();
  const endingSoon: Lot[] = [];
  for (const lot of lots) {
    const end =
      lot.endTime instanceof Date ? lot.endTime.getTime() : Date.parse(String(lot.endTime));
    if (
      lot.status === "active" &&
      Number.isFinite(end) &&
      end - now > 0 &&
      end - now <= ENDING_SOON_WINDOW_MS
    ) {
      endingSoon.push(lot);
    }
  }
  return endingSoon;
}

export const getHomeData = cache(async (): Promise<HomePageData> => {
  let upcoming: Lot[] = [];
  let salesRows: HomeSaleListRow[] = [];
  try {
    const filtered: ListLotsParams = {
      limit: 12,
      status: "active",
      sort: "endingAsc",
    };
    upcoming = await fetchHomeLots(filtered);
    if (upcoming.length === 0) {
      upcoming = await fetchHomeLots({ limit: 12, sort: "endingAsc" });
    }
    // Upcoming-auctions strip: scheduled + active, both delivery modes. Public list API has no
    // `deliveryMode` param (see listSalesQuerySchema); onsite/online tabs filter client-side.
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
  const endingSoonLots = toEndingSoonLotCardVMs(endingSoonWithoutHero.slice(0, 4));
  const endingSoonRowIds = new Set(endingSoonWithoutHero.slice(0, 4).map((l) => l.id));
  const upcomingAfterHero = upcoming.filter(
    (l) => l.id !== featuredLot?.id && !endingSoonRowIds.has(l.id),
  );
  const jsonLdListFallback = jsonLdListEntriesFromLots(upcomingAfterHero.slice(0, 4));
  const upcomingAuctionTiles = toHomeUpcomingAuctionTileVMs(salesRows);
  const editorsPickLots = toEditorsPickLotCardVMs(upcomingAfterHero.slice(0, 12));
  const privateSaleHighlights = toPrivateSaleHighlightVMs(
    pickPrivateSaleHighlightLots(upcomingAfterHero),
  );

  const base = {
    jsonLdListFallback,
    endingSoonLots,
    upcomingAuctionTiles,
    editorsPickLots,
    privateSaleHighlights,
  };

  try {
    const activeRows = await fetchHomeSales({ status: "active", limit: 10 });
    for (const row of activeRows) {
      const { sale } = row;
      if (sale.deliveryMode !== "onsite") continue;
      if (!sale.streamUrl) continue;
      const embed = parseStreamEmbedUrl(sale.streamUrl);
      if (!embed) continue;
      const modeLabel = "Onsite";
      return {
        ...base,
        heroState: {
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
        },
      };
    }

    const rotatorRows = await fetchHomeSales({
      statuses: ["scheduled", "active"],
      sort: "startAsc",
      limit: 5,
    });
    if (rotatorRows.length > 0) {
      return {
        ...base,
        heroState: {
          kind: "rotator",
          slides: rotatorRows.map((r) => toHeroSaleSlideVM(r.sale)),
        },
      };
    }
  } catch (err) {
    console.error("[getHomeData] hero sale load failed", err);
  }

  return {
    ...base,
    heroState: { kind: "fallbackLot", lot: heroVm },
  };
});
