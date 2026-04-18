import type { ArtistProfile } from "@/lib/data/contracts";
import type { SaleListRow } from "@/lib/data/http/sales.server";
import { formatLotAuctionLine, formatSaleDateRange } from "@/lib/format-auction-date";
import { formatMoney } from "@/lib/format-currency";
import { featuredLotHeading, lotLabelFromLot } from "@/lib/lot-label";
import type { Lot } from "@auction/types";

const HERO_FALLBACK_IMG =
  "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1920&q=80";

export type HeroLotVM = {
  id: string;
  title: string;
  artistName: string;
  estimateFormatted: string;
  currentBidFormatted: string;
  bidCountDisplay: string;
  heroImageUrl: string;
  auctionDateLabel: string;
  /** Second segment after live dot, e.g. sale title */
  saleMetaLine: string;
  featuredHeading: string;
};

export type LotCardVM = {
  id: string;
  href: string;
  lotLabel: string;
  title: string;
  artistName: string;
  estimateFormatted: string;
  imageUrl: string | null;
};

export type AuctionFeaturedLotVM = {
  id: string;
  href: string;
  title: string;
  artistName: string;
  estimateFormatted: string;
  imageUrl: string | null;
};

export type UpcomingAuctionVM = {
  id: string;
  href: string;
  title: string;
  dateLabel: string;
  coverImageUrl: string | null;
  featuredLots: AuctionFeaturedLotVM[];
};

export type ArtistCardVM = {
  id: string;
  name: string;
  portraitUrl: string;
  href: string;
};

function artistLineFromLot(lot: Lot): string {
  return lot.medium?.trim() || lot.description?.trim()?.slice(0, 80) || "Contemporary";
}

export function toHeroLotVM(lot: Lot, saleTitle: string | null): HeroLotVM {
  const saleMetaLine = saleTitle?.trim() || formatLotAuctionLine(lot);
  return {
    id: lot.id,
    title: lot.title,
    artistName: artistLineFromLot(lot),
    estimateFormatted: formatMoney(lot.startingPrice),
    currentBidFormatted: formatMoney(lot.currentPrice),
    bidCountDisplay: "—",
    heroImageUrl: lot.images[0] ?? HERO_FALLBACK_IMG,
    auctionDateLabel: formatLotAuctionLine(lot),
    saleMetaLine,
    featuredHeading: featuredLotHeading(lot),
  };
}

export function toLotCardVM(lot: Lot): LotCardVM {
  return {
    id: lot.id,
    href: `/artwork/${lot.id}`,
    lotLabel: lotLabelFromLot(lot),
    title: lot.title,
    artistName: artistLineFromLot(lot),
    estimateFormatted: formatMoney(lot.startingPrice),
    imageUrl: lot.images[0] ?? null,
  };
}

export function toLotCardVMs(lots: Lot[]): LotCardVM[] {
  return lots.map(toLotCardVM);
}

function toAuctionFeaturedLotVM(lot: Lot): AuctionFeaturedLotVM {
  return {
    id: lot.id,
    href: `/artwork/${lot.id}`,
    title: lot.title,
    artistName: artistLineFromLot(lot),
    estimateFormatted: formatMoney(lot.startingPrice),
    imageUrl: lot.images[0] ?? null,
  };
}

export function toUpcomingAuctionVM(row: SaleListRow): UpcomingAuctionVM {
  const { sale, lots } = row;
  return {
    id: sale.id,
    href: `/sales/${sale.id}`,
    title: sale.title,
    dateLabel: formatSaleDateRange(sale),
    coverImageUrl: sale.coverImages[0] ?? null,
    featuredLots: lots.slice(0, 2).map(toAuctionFeaturedLotVM),
  };
}

export function toArtistCardVMs(profiles: ArtistProfile[]): ArtistCardVM[] {
  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    portraitUrl: p.portraitUrl,
    href: `/artist/${p.id}`,
  }));
}
