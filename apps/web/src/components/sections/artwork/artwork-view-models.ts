import type { PublicUser } from "@/lib/data/contracts";
import { formatMoney } from "@/lib/format-currency";
import type { Bid, Lot, LotMarketingDetails } from "@auction/types";
import type { ReactNode } from "react";
import { lotMarketingSection } from "./lot-marketing-sections";

/** Ids for programmatic accordion items (see `buildArtworkPageAccordionBlocks`). */
export const ARTWORK_PAGE_ACCORDION_IDS = {
  lotDetails: "lot-details",
  bidHistory: "bid-history",
} as const;

export type LotHeroVM = {
  firstSegmentHref: string;
  firstSegmentLabel: string;
  saleHref: string | null;
  saleTitle: string | null;
  lotNumberLabel: string | null;
  prevHref: string | null;
  nextHref: string | null;
  /** e.g. "1 / 8" when navigating within a sale; null if unknown */
  positionLabel: string | null;
  /**
   * Optional Home segment prepended to the breadcrumb so the trail reads
   * Home › Sale › Lot N (mockup parity). When omitted the breadcrumb keeps
   * the historical "Auctions" first crumb behaviour.
   */
  homeSegment?: { label: string; href: string };
};

export type LotRailCardVM = {
  id: string;
  href: string;
  imageUrl: string | null;
  lotNumber: number | null;
  title: string;
  artistOrSellerName: string;
  estimateLine: string | null;
  currentPrice: string;
  endTime: Date;
  status: Lot["status"];
  sellerId: string;
};

export type LotRelatedRailVM = {
  mode: "sale" | "seller";
  heading: string;
  viewAuctionHref: string | null;
  cards: LotRailCardVM[];
};

export type AccordionBlock = {
  id: string;
  title: string;
  /** Marketing copy (plain). Omit when `contentNode` is set. */
  content?: string;
  /** Rich content (e.g. lot details, bid history). When set, overrides `content`. */
  contentNode?: ReactNode;
  /** When true, block is omitted from render */
  hidden: boolean;
};

function sortSaleLotsForNav(lots: Lot[]): Lot[] {
  return [...lots].sort((a, b) => {
    const an = a.lotNumber;
    const bn = b.lotNumber;
    if (an != null && bn != null) return an - bn;
    if (an != null) return -1;
    if (bn != null) return 1;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Breadcrumb + prev/next within the current sale (when `saleId` and lots are known).
 */
export function mapLotToHeroVM(
  lot: Lot,
  parentSale: { id: string; title: string } | null,
  saleLots: Lot[] | null,
): LotHeroVM {
  const firstSegmentHref = "/sales";
  const firstSegmentLabel = "Auctions";

  const homeSegment = { label: "Home", href: "/" } as const;

  if (!parentSale || !lot.saleId) {
    return {
      firstSegmentHref,
      firstSegmentLabel,
      saleHref: null,
      saleTitle: null,
      lotNumberLabel: lot.lotNumber != null ? `LOT ${lot.lotNumber}` : null,
      prevHref: null,
      nextHref: null,
      positionLabel: null,
      homeSegment,
    };
  }

  const ordered = sortSaleLotsForNav(saleLots?.filter((l) => l.saleId === lot.saleId) ?? []);
  const idx = ordered.findIndex((l) => l.id === lot.id);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  const positionLabel = idx >= 0 && ordered.length > 0 ? `${idx + 1} / ${ordered.length}` : null;

  return {
    firstSegmentHref,
    firstSegmentLabel,
    saleHref: `/sales/${parentSale.id}`,
    saleTitle: parentSale.title,
    lotNumberLabel:
      lot.lotNumber != null
        ? `LOT ${lot.lotNumber}`
        : `LOT ${lot.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    prevHref: prev ? `/artwork/${prev.id}` : null,
    nextHref: next ? `/artwork/${next.id}` : null,
    positionLabel,
    homeSegment,
  };
}

export type LotSummarySeedVM = {
  title: string;
  kicker: string | null;
  estimateLine: string | null;
  sellerName: string;
  sellerHref: string;
  /** Public profile / OAuth image when available */
  sellerImageUrl: string | null;
};

/**
 * Static hero copy; live bid/close values come from `ArtworkBidPanel` client state.
 */
export function mapLotToSummarySeed(
  lot: Lot,
  sellerName: string,
  sellerHref: string,
  sellerImageUrl: string | null = null,
): LotSummarySeedVM {
  const est = lot.marketingDetails.estimate;
  const estimateLine = est
    ? `${formatMoney(est.low)} – ${formatMoney(est.high)} ${est.currency}`
    : null;
  return {
    title: lot.title,
    kicker: null,
    estimateLine,
    sellerName,
    sellerHref,
    sellerImageUrl,
  };
}

/** Plain text for accordion / search; shared with other surfaces that need the same copy. */
export function formatProvenanceList(
  items: NonNullable<LotMarketingDetails["provenance"]>,
): string {
  if (!items.length) return "";
  return items.map((p) => (p.period ? `${p.period}: ` : "") + p.note).join("\n\n");
}

export function formatExhibitions(list: NonNullable<LotMarketingDetails["exhibitions"]>): string {
  if (!list.length) return "";
  return list
    .map((e: { year?: string; venue: string; note?: string }) => {
      const line = e.year ? `${e.year} — ${e.venue}` : e.venue;
      return e.note ? `${line}\n${e.note}` : line;
    })
    .join("\n\n");
}

/** Same body text as the “About artist” accordion item. */
export function aboutArtistBlockContent(lot: Lot, artist: PublicUser | null): string {
  const md = lot.marketingDetails;
  const aboutName = artist?.name ?? "";
  return (
    md.artistNote?.trim() ||
    (aboutName ? `${aboutName}. See the seller/artist profile for more context.` : "")
  );
}

/**
 * Data-driven accordion list; `hidden` items are filtered out in the component.
 */
export function mapLotToAccordionBlocks(lot: Lot, artist: PublicUser | null): AccordionBlock[] {
  const md = lot.marketingDetails;
  const cr = md.conditionReport;
  const crText = [cr?.summary, cr?.details, cr?.downloadUrl ? `Download: ${cr.downloadUrl}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const prov = formatProvenanceList(md.provenance ?? []);
  const ex = formatExhibitions(md.exhibitions ?? []);

  const aboutText = aboutArtistBlockContent(lot, artist);

  return [
    {
      id: lotMarketingSection.condition.id,
      title: lotMarketingSection.condition.title,
      content: crText,
      hidden: crText.trim() === "",
    },
    {
      id: lotMarketingSection.provenance.id,
      title: lotMarketingSection.provenance.title,
      content: prov,
      hidden: !prov.trim(),
    },
    {
      id: lotMarketingSection.exhibited.id,
      title: lotMarketingSection.exhibited.title,
      content: ex,
      hidden: !ex.trim(),
    },
    {
      id: lotMarketingSection.artist.id,
      title: lotMarketingSection.artist.title,
      content: aboutText,
      hidden: !aboutText.trim(),
    },
  ];
}

function lotToRailCard(lot: Lot, artistName: string): LotRailCardVM {
  const est = lot.marketingDetails.estimate;
  return {
    id: lot.id,
    href: `/artwork/${lot.id}`,
    imageUrl: lot.images[0] ?? null,
    lotNumber: lot.lotNumber,
    title: lot.title,
    artistOrSellerName: artistName,
    estimateLine: est ? `${formatMoney(est.low)} – ${formatMoney(est.high)} ${est.currency}` : null,
    currentPrice: lot.currentPrice,
    endTime: lot.endTime,
    status: lot.status,
    sellerId: lot.sellerId,
  };
}

const MIN_SALE_SIBLINGS = 1;

/**
 * Prefers other lots from the same sale; falls back to the seller’s active list when the sale
 * is missing or has too few peers.
 */
export function mapSiblingsToRailVM(
  lot: Lot,
  parentSale: { id: string; title: string } | null,
  saleLots: Lot[] | null,
  sellerRelated: Lot[],
  resolveSellerName: (l: Lot) => string,
): LotRelatedRailVM {
  const saleSiblings = (saleLots ?? []).filter((l) => l.id !== lot.id);
  const useSale =
    Boolean(parentSale) && lot.saleId != null && saleSiblings.length >= MIN_SALE_SIBLINGS;

  const source = useSale
    ? sortSaleLotsForNav(saleSiblings).slice(0, 4)
    : sellerRelated.filter((l) => l.id !== lot.id).slice(0, 4);

  if (source.length === 0) {
    return { mode: useSale ? "sale" : "seller", heading: "", viewAuctionHref: null, cards: [] };
  }

  return {
    mode: useSale ? "sale" : "seller",
    heading: useSale && parentSale ? `More from ${parentSale.title}` : "More from this seller",
    viewAuctionHref: useSale && parentSale ? `/sales/${parentSale.id}` : null,
    cards: source.map((l) => lotToRailCard(l, resolveSellerName(l))),
  };
}

/**
 * For auto-bid panel: latest bid from this user with optional max.
 */
export function findUserLatestBidMeta(
  userId: string | undefined,
  bids: Pick<Bid, "bidderId" | "maxAutoBidAmount" | "createdAt" | "amount" | "id">[],
): { maxAutoBidAmount: string | null; amount: string; bidId: string } | null {
  if (!userId) return null;
  const mine = bids.filter((b) => b.bidderId === userId);
  if (mine.length === 0) return null;
  mine.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latest = mine[0];
  if (!latest) return null;
  return {
    maxAutoBidAmount: latest.maxAutoBidAmount,
    amount: latest.amount,
    bidId: latest.id,
  };
}
