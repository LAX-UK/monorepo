import {
  toArtistCardVMs,
  toHeroLotVM,
  toLotCardVMs,
  toUpcomingAuctionVM,
} from "@/components/sections/home/home-view-models";
import { LaxArtists } from "@/components/sections/home/lax-artists";
import { LaxHero } from "@/components/sections/home/lax-hero";
import { LaxUpcomingAuctions } from "@/components/sections/home/lax-upcoming-auctions";
import { LaxUpcomingLots } from "@/components/sections/home/lax-upcoming-lots";
import type { ListLotsParams } from "@/lib/data/contracts";
import { getServerArtistReader } from "@/lib/data/http/artist.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSalesList } from "@/lib/data/http/sales.server";
import type { Lot } from "@auction/types";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: PageProps) {
  await searchParams;

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
    console.error("[HomePage] data load failed", err);
  }

  const featuredLot = upcoming[0] ?? null;
  const firstSale = salesRows[0] ?? null;
  const saleTitleForHero =
    featuredLot && firstSale && featuredLot.saleId === firstSale.sale.id
      ? firstSale.sale.title
      : (firstSale?.sale.title ?? null);

  const heroVm = featuredLot ? toHeroLotVM(featuredLot, saleTitleForHero) : null;
  const lotCards = toLotCardVMs(upcoming.slice(1, 5));
  const auctionVm = firstSale ? toUpcomingAuctionVM(firstSale) : null;
  const artistCards = toArtistCardVMs(artists.slice(0, 4));

  const saleMetaLine = firstSale?.sale.title ?? "Evening Sale · Spring 2025";

  return (
    <main id="main-content" className="bg-page-bg pt-[114px]">
      <LaxHero lot={heroVm} />
      <LaxUpcomingLots items={lotCards} saleMetaLine={saleMetaLine} />
      {auctionVm ? <LaxUpcomingAuctions auction={auctionVm} /> : null}
      <LaxArtists items={artistCards} />
    </main>
  );
}
