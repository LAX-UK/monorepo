import "server-only";

import { HERO_PLACEHOLDER_SALE_LINE } from "@/components/sections/home/home-defaults";
import {
  type ArtistCardVM,
  type HeroLotVM,
  type HeroStateVM,
  type LotCardVM,
  type UpcomingAuctionVM,
  createHeroFallbackVm,
  toArtistCardVMs,
  toHeroLotVM,
  toHeroSaleSlideVM,
  toLotCardVMs,
  toUpcomingAuctionVM,
} from "@/components/sections/home/home-view-models";
import type { ArtistProfile, ListLotsParams } from "@/lib/data/contracts";
import { mapPublicUserToArtist } from "@/lib/data/http/artist.server";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { buildLotListQuery } from "@/lib/data/http/lots.server";
import { parseLot, parseSale } from "@/lib/data/http/parse";
import { salePath } from "@/lib/seo/url";
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

export type HomePageData = {
  heroState: HeroStateVM;
  lotCards: LotCardVM[];
  auctionVm: UpcomingAuctionVM | null;
  artistCards: ArtistCardVM[];
  saleMetaLine: string;
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

async function fetchHomeFeaturedArtists(): Promise<ArtistProfile[]> {
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") return [];
  const res = await fetch(`${getServerApiBase()}/users/public/artists?limit=24&offset=0`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    data: { id: string; name: string; image?: string | null }[];
  };
  return body.data.map(mapPublicUserToArtist);
}

export const getHomeData = cache(async (): Promise<HomePageData> => {
  let upcoming: Lot[] = [];
  let salesRows: HomeSaleListRow[] = [];
  let artists: ArtistProfile[] = [];

  try {
    const filtered: ListLotsParams = {
      limit: 5,
      status: "active",
      sort: "endingAsc",
    };
    upcoming = await fetchHomeLots(filtered);
    if (upcoming.length === 0) {
      upcoming = await fetchHomeLots({ limit: 5, sort: "endingAsc" });
    }
    const [salesResult, artistsResult] = await Promise.all([
      fetchHomeSales({ status: "active", limit: 1 }),
      fetchHomeFeaturedArtists(),
    ]);
    salesRows = salesResult;
    artists = artistsResult;
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
  const lotCards = toLotCardVMs(upcoming.slice(1, 5));
  const auctionVm = firstSale ? toUpcomingAuctionVM(firstSale) : null;
  const artistCards = toArtistCardVMs(artists.slice(0, 4));
  const saleMetaLine = firstSale?.sale.title ?? HERO_PLACEHOLDER_SALE_LINE;

  const base = { lotCards, auctionVm, artistCards, saleMetaLine };

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
