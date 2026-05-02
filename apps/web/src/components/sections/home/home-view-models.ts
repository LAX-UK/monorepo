import type { ArtistProfile } from "@/lib/data/contracts";
import type { SaleListRow } from "@/lib/data/http/sales.server";
import { formatLotAuctionLine, formatSaleDateRange } from "@/lib/format-auction-date";
import { formatMoney } from "@/lib/format-currency";
import { featuredLotHeading, lotLabelFromLot } from "@/lib/lot-label";
import { lotPriceDisplay } from "@/lib/lot-price-display";
import type { Lot, LotStatus, Sale } from "@auction/types";
import type { StreamEmbedProvider } from "@auction/validators";
import {
  HERO_FALLBACK_IMG,
  HERO_PLACEHOLDER_ARTIST,
  HERO_PLACEHOLDER_FEATURED_HEADING,
  HERO_PLACEHOLDER_SALE_LINE,
  HERO_PLACEHOLDER_TITLE,
} from "./home-defaults";

export type HeroLotVM = {
  id: string;
  title: string;
  artistName: string;
  priceLabel: string;
  priceFormatted: string;
  currentBidFormatted: string;
  bidCountDisplay: string;
  heroImageUrl: string;
  /** Descriptive alt for the hero artwork image */
  imageAlt: string;
  auctionDateLabel: string;
  /** Second segment after live dot, e.g. sale title */
  saleMetaLine: string;
  featuredHeading: string;
  lotLabel: string;
  /** True when lot status is active (for live region announcements). */
  isAuctionLive: boolean;
};

export type HeroSaleSlideVM = {
  id: string;
  href: string;
  title: string;
  dateLabel: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
  modeBadge: "Online" | "Onsite";
};

export type HeroStateVM =
  | {
      kind: "live";
      saleId: string;
      saleTitle: string;
      embedSrc: string;
      provider: StreamEmbedProvider;
      modeLabel: string;
      saleroomHref: string;
      /** Present when provider is youtube — used for background embed + watch link */
      videoId?: string | undefined;
      startSeconds?: number | undefined;
      /** Sale cover for reduced-motion / visual fallback */
      posterImageUrl?: string | null | undefined;
    }
  | { kind: "rotator"; slides: HeroSaleSlideVM[] }
  | { kind: "editorial"; sale: HeroSaleSlideVM; isLive?: boolean }
  | { kind: "fallbackLot"; lot: HeroLotVM };

export type LotCardVM = {
  id: string;
  href: string;
  lotLabel: string;
  title: string;
  artistName: string;
  priceLabel: string;
  priceFormatted: string;
  imageUrl: string | null;
  /** Alt text when `imageUrl` is set */
  imageAlt: string;
  sellerId: string;
  status: LotStatus;
  /** ISO 8601 — used by client lot timer */
  startTime: string;
  /** ISO 8601 — used by client lot timer */
  endTime: string;
};

export type AuctionFeaturedLotVM = {
  id: string;
  href: string;
  title: string;
  artistName: string;
  priceLabel: string;
  priceFormatted: string;
  imageUrl: string | null;
  imageAlt: string;
  sellerId: string;
};

export type UpcomingAuctionVM = {
  id: string;
  href: string;
  title: string;
  dateLabel: string;
  coverImageUrl: string | null;
  coverImageAlt: string;
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

function heroImageAlt(title: string, artistName: string): string {
  return `${title} — artwork by ${artistName}`;
}

export function toHeroSaleSlideVM(sale: Sale): HeroSaleSlideVM {
  const modeBadge: HeroSaleSlideVM["modeBadge"] =
    sale.deliveryMode === "online" ? "Online" : "Onsite";
  return {
    id: sale.id,
    href: `/sales/${sale.id}`,
    title: sale.title,
    dateLabel: formatSaleDateRange(sale),
    coverImageUrl: sale.coverImages[0] ?? null,
    coverImageAlt: `${sale.title} — auction cover`,
    modeBadge,
  };
}

export function createHeroFallbackVm(): HeroLotVM {
  return {
    id: "placeholder",
    title: HERO_PLACEHOLDER_TITLE,
    artistName: HERO_PLACEHOLDER_ARTIST,
    priceLabel: "Catalogue",
    priceFormatted: "—",
    currentBidFormatted: "—",
    bidCountDisplay: "—",
    heroImageUrl: HERO_FALLBACK_IMG,
    imageAlt: "Abstract gallery artwork — decorative hero background",
    auctionDateLabel: HERO_PLACEHOLDER_SALE_LINE,
    saleMetaLine: HERO_PLACEHOLDER_SALE_LINE,
    featuredHeading: HERO_PLACEHOLDER_FEATURED_HEADING,
    lotLabel: "Lot",
    isAuctionLive: false,
  };
}

export function toHeroLotVM(lot: Lot, saleTitle: string | null): HeroLotVM {
  const saleMetaLine = saleTitle?.trim() || formatLotAuctionLine(lot);
  const artistName = artistLineFromLot(lot);
  const primary = lotPriceDisplay(lot);
  return {
    id: lot.id,
    title: lot.title,
    artistName,
    priceLabel: primary.label,
    priceFormatted: primary.value,
    currentBidFormatted: formatMoney(lot.currentPrice),
    bidCountDisplay: "—",
    heroImageUrl: lot.images[0] ?? HERO_FALLBACK_IMG,
    imageAlt: heroImageAlt(lot.title, artistName),
    auctionDateLabel: formatLotAuctionLine(lot),
    saleMetaLine,
    featuredHeading: featuredLotHeading(lot),
    lotLabel: lotLabelFromLot(lot),
    isAuctionLive: lot.status === "active",
  };
}

export function toLotCardVM(lot: Lot): LotCardVM {
  const artistName = artistLineFromLot(lot);
  const { label, value } = lotPriceDisplay(lot);
  const startTime =
    lot.startTime instanceof Date ? lot.startTime.toISOString() : String(lot.startTime);
  const endTime = lot.endTime instanceof Date ? lot.endTime.toISOString() : String(lot.endTime);
  return {
    id: lot.id,
    href: `/artwork/${lot.id}`,
    lotLabel: lotLabelFromLot(lot),
    title: lot.title,
    artistName,
    priceLabel: label,
    priceFormatted: value,
    imageUrl: lot.images[0] ?? null,
    imageAlt: `${lot.title} — artwork by ${artistName}`,
    sellerId: lot.sellerId,
    status: lot.status,
    startTime,
    endTime,
  };
}

export function toLotCardVMs(lots: Lot[]): LotCardVM[] {
  return lots.map(toLotCardVM);
}

function toAuctionFeaturedLotVM(lot: Lot): AuctionFeaturedLotVM {
  const artistName = artistLineFromLot(lot);
  const { label, value } = lotPriceDisplay(lot);
  return {
    id: lot.id,
    href: `/artwork/${lot.id}`,
    title: lot.title,
    artistName,
    priceLabel: label,
    priceFormatted: value,
    imageUrl: lot.images[0] ?? null,
    imageAlt: `${lot.title} — artwork by ${artistName}`,
    sellerId: lot.sellerId,
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
    coverImageAlt: `${sale.title} — auction cover`,
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
