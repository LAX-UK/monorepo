import "server-only";

import { HERO_PLACEHOLDER_SALE_LINE } from "@/components/sections/home/home-defaults";
import {
  type ArtistCardVM,
  type HeroLotVM,
  type LotCardVM,
  type UpcomingAuctionVM,
  createHeroFallbackVm,
  toArtistCardVMs,
  toHeroLotVM,
  toLotCardVMs,
  toUpcomingAuctionVM,
} from "@/components/sections/home/home-view-models";
import type { ListLotsParams } from "@/lib/data/contracts";
import { getServerArtistReader } from "@/lib/data/http/artist.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSalesList } from "@/lib/data/http/sales.server";
import type { Lot } from "@auction/types";

export type HomePageData = {
  heroVm: HeroLotVM;
  lotCards: LotCardVM[];
  auctionVm: UpcomingAuctionVM | null;
  artistCards: ArtistCardVM[];
  saleMetaLine: string;
};

export async function getHomeData(): Promise<HomePageData> {
  let upcoming: Lot[] = [];
  let salesRows: Awaited<ReturnType<typeof getServerSalesList>> = [];
  let artists: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerArtistReader>>["listFeatured"]>
  > = [];

  try {
    const reader = await getServerLotReader();
    const artistReader = await getServerArtistReader();
    const filtered: ListLotsParams = {
      limit: 5,
      status: "active",
      sort: "endingAsc",
    };
    upcoming = await reader.list(filtered);
    if (upcoming.length === 0) {
      upcoming = await reader.list({ limit: 5, sort: "endingAsc" });
    }
    const [salesResult, artistsResult] = await Promise.all([
      getServerSalesList({ status: "active", limit: 1 }),
      artistReader.listFeatured(),
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

  const heroVm = featuredLot ? toHeroLotVM(featuredLot, saleTitleForHero) : createHeroFallbackVm();
  const lotCards = toLotCardVMs(upcoming.slice(1, 5));
  const auctionVm = firstSale ? toUpcomingAuctionVM(firstSale) : null;
  const artistCards = toArtistCardVMs(artists.slice(0, 4));
  const saleMetaLine = firstSale?.sale.title ?? HERO_PLACEHOLDER_SALE_LINE;

  return { heroVm, lotCards, auctionVm, artistCards, saleMetaLine };
}
