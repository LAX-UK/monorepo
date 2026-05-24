import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import type { PublicUser } from "@/lib/data/contracts";
import { formatMoney } from "@/lib/format-currency";
import { lotPath, salePath } from "@/lib/seo/url";
import type { Bid, Lot, LotMarketingDetails } from "@auction/types";
import type { ReactNode } from "react";
import { lotMarketingSection } from "./lot-marketing-sections";

/** Ids for programmatic accordion items (see `buildArtworkPageAccordionBlocks`). */
export const ARTWORK_PAGE_ACCORDION_IDS = {
  lotDetails: "lot-details",
  bidHistory: "bid-history",
  fees: "fees",
  documents: "lot-documents",
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
  /** Optional Home segment prepended to the breadcrumb so the trail reads
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

/** Breadcrumb + prev/next within the current sale (when `saleId` and lots are known).
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
    saleHref: salePath(parentSale),
    saleTitle: parentSale.title,
    lotNumberLabel:
      lot.lotNumber != null
        ? `LOT ${lot.lotNumber}`
        : `LOT ${lot.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
    prevHref: prev ? lotPath(prev) : null,
    nextHref: next ? lotPath(next) : null,
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

/** Static hero copy; live bid/close values come from `ArtworkBidPanel` client state.
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

/** Data-driven accordion list; `hidden` items are filtered out in the component.
 */
export function mapLotToAccordionBlocks(lot: Lot, artist: PublicUser | null): AccordionBlock[] {
  const md = lot.marketingDetails;
  const est = md.estimate;
  const estimateText =
    est?.low != null && est?.high != null
      ? `${formatMoney(est.low)} – ${formatMoney(est.high)} ${est.currency}`.trim()
      : "";
  const cr = md.conditionReport;
  const crText = [cr?.summary, cr?.details, cr?.downloadUrl ? `Download: ${cr.downloadUrl}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const prov = formatProvenanceList(md.provenance ?? []);
  const ex = formatExhibitions(md.exhibitions ?? []);

  const aboutText = aboutArtistBlockContent(lot, artist);

  return [
    {
      id: lotMarketingSection.estimate.id,
      title: lotMarketingSection.estimate.title,
      content: estimateText,
      hidden: estimateText.trim() === "",
    },
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
    href: lotPath(lot),
    imageUrl: lot.images[0] ?? null,
    lotNumber: lot.lotNumber,
    title: lot.title,
    artistOrSellerName: artistName,
    estimateLine: est ? `${formatMoney(est.low)} – ${formatMoney(est.high)} ${est.currency}` : null,
    currentPrice: lot.currentPrice,
    endTime: lot.endTime,
    status: lot.status,
    sellerId: lot.sellerId ?? lot.sellerLegalEntityId ?? "",
  };
}

const MIN_SALE_SIBLINGS = 1;

/** Prefers other lots from the same sale; falls back to the seller’s active list when the sale
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
    viewAuctionHref: useSale && parentSale ? salePath(parentSale) : null,
    cards: source.map((l) => lotToRailCard(l, resolveSellerName(l))),
  };
}

/** For auto-bid panel: latest bid from this user with optional proxy settings.
 */
export function findUserLatestBidMeta(
  userId: string | undefined,
  bids: Pick<
    Bid,
    | "bidderId"
    | "placedByUserId"
    | "maxAutoBidAmount"
    | "autoBidStepAmount"
    | "createdAt"
    | "amount"
    | "id"
  >[],
): {
  maxAutoBidAmount: string | null;
  autoBidStepAmount: string | null;
  amount: string;
  bidId: string;
  isActive: boolean;
} | null {
  if (!userId) return null;
  const mine = bids.filter((b) => (b.bidderId ?? b.placedByUserId) === userId);
  if (mine.length === 0) return null;
  mine.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latest = mine[0];
  if (!latest) return null;
  const max = latest.maxAutoBidAmount;
  return {
    maxAutoBidAmount: max,
    autoBidStepAmount: latest.autoBidStepAmount ?? null,
    amount: latest.amount,
    bidId: latest.id,
    isActive: max != null && max.trim() !== "",
  };
}

/** Single lot row in the online session queue (sidebar or horizontal rail). */
export type LotQueueCardVM = {
  id: string;
  href: string;
  lotNumber: number | null;
  title: string;
  artistName: string;
  imageUrl: string | null;
  estimateLine: string | null;
  currentBid: string | null;
  isCurrentLot: boolean;
  isUpNext: boolean;
};

/** Live / onsite bid feed row (paddle anonymized in UI). */
export type BidFeedEntryVM = {
  id: string;
  paddleNumber: string;
  amount: string;
  rank: number;
  isHighest: boolean;
  isYourBid: boolean;
  timestamp: number;
};

/** Top session bar for online auction layout. */
export type AuctionSessionHeaderVM = {
  saleTitle: string;
  lotLabel: string;
  paddleNumber: string | null;
  userVerified: boolean;
};

function lotToQueueCardVM(
  lot: Lot,
  artistName: string,
  flags: { isCurrentLot: boolean; isUpNext: boolean },
): LotQueueCardVM {
  const est = lot.marketingDetails.estimate;
  return {
    id: lot.id,
    href: lotPath(lot),
    lotNumber: lot.lotNumber,
    title: lot.title,
    artistName,
    imageUrl: lot.images[0] ?? null,
    estimateLine: est ? `${formatMoney(est.low)} – ${formatMoney(est.high)} ${est.currency}` : null,
    currentBid: lot.currentPrice ? formatMoney(lot.currentPrice) : null,
    isCurrentLot: flags.isCurrentLot,
    isUpNext: flags.isUpNext,
  };
}

/** Lots that may still appear in Up next / Queue (not finished or unpublished). */
function isQueueEligibleStatus(status: Lot["status"]): boolean {
  return status === "active" || status === "scheduled";
}

/** Build queue VMs for the current sale (ordered nav); empty when not in a sale.
 * Up next and Queue only include lots that are `active` or `scheduled` (in catalog order after the current lot).
 */
export function mapSaleLotsToQueueVMs(
  currentLot: Lot,
  saleLots: Lot[] | null,
  resolveArtistName: (l: Lot) => string,
): { current: LotQueueCardVM; upNext: LotQueueCardVM | null; queue: LotQueueCardVM[] } {
  const ordered = sortSaleLotsForNav(saleLots?.filter((l) => l.saleId === currentLot.saleId) ?? []);
  const idx = ordered.findIndex((l) => l.id === currentLot.id);
  if (idx < 0) {
    const solo = lotToQueueCardVM(currentLot, resolveArtistName(currentLot), {
      isCurrentLot: true,
      isUpNext: false,
    });
    return { current: solo, upNext: null, queue: [] };
  }
  const cur = ordered[idx];
  if (!cur) {
    const solo = lotToQueueCardVM(currentLot, resolveArtistName(currentLot), {
      isCurrentLot: true,
      isUpNext: false,
    });
    return { current: solo, upNext: null, queue: [] };
  }
  const current = lotToQueueCardVM(cur, resolveArtistName(cur), {
    isCurrentLot: true,
    isUpNext: false,
  });
  const afterCurrent = ordered.slice(idx + 1);
  const upcoming = afterCurrent.filter((l) => isQueueEligibleStatus(l.status));
  const nextLot = upcoming[0] ?? null;
  const upNext = nextLot
    ? lotToQueueCardVM(nextLot, resolveArtistName(nextLot), { isCurrentLot: false, isUpNext: true })
    : null;
  const queue = upcoming
    .slice(1)
    .map((l) =>
      lotToQueueCardVM(l, resolveArtistName(l), { isCurrentLot: false, isUpNext: false }),
    );
  return { current, upNext, queue };
}

export function maskPaddleFromBidderId(bidderId: string): string {
  const tail = bidderId.replace(/-/g, "").slice(-4).toUpperCase();
  return tail ? `Paddle#•••${tail}` : "Paddle#—";
}

/** Current user's bid rows for the "Your bids" card (online mockup). */
export type UserBidHistoryRowVM = {
  id: string;
  amount: string;
  status: "highest" | "outbid" | "won";
};

export type UserBidsHistoryVM = {
  count: number;
  paddleLabel: string;
  rows: UserBidHistoryRowVM[];
};

/** Pure mapper: newest user bids first; status from global leading bid and lot outcome. */
export function mapUserBidsHistoryVM(
  entries: BidHistoryEntry[],
  userId: string | null,
  lot: Pick<Lot, "status" | "winnerId">,
): UserBidsHistoryVM | null {
  if (!userId || entries.length === 0) return null;
  const userBids = entries.filter((e) => e.bidderId === userId);
  if (userBids.length === 0) return null;

  const sortedByAmount = [...entries].sort((a, b) => {
    const na = Number.parseFloat(a.amount);
    const nb = Number.parseFloat(b.amount);
    if (nb !== na) return nb - na;
    return b.at - a.at;
  });
  const top = sortedByAmount[0];
  if (!top) return null;

  const rows: UserBidHistoryRowVM[] = [...userBids]
    .sort((a, b) => b.at - a.at)
    .map((e) => {
      const isLeadingBid = e.id === top.id && e.bidderId === top.bidderId;
      let status: UserBidHistoryRowVM["status"] = "outbid";
      if (isLeadingBid) {
        const userWon = lot.status === "ended" && lot.winnerId === userId;
        status = userWon ? "won" : "highest";
      }
      return {
        id: e.id,
        amount: formatMoney(e.amount),
        status,
      };
    });

  return {
    count: userBids.length,
    paddleLabel: maskPaddleFromBidderId(userId),
    rows,
  };
}

/** Map bid history to feed rows: highest amount first, stable tie-breaker by recency. */
export function mapBidHistoryToFeedEntries(
  entries: BidHistoryEntry[],
  currentUserId: string | null,
): BidFeedEntryVM[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => {
    const na = Number.parseFloat(a.amount);
    const nb = Number.parseFloat(b.amount);
    if (nb !== na) return nb - na;
    return b.at - a.at;
  });
  return sorted.map((e, i) => ({
    id: e.id,
    paddleNumber: maskPaddleFromBidderId(e.bidderId),
    amount: formatMoney(e.amount),
    rank: i + 1,
    isHighest: i === 0,
    isYourBid: Boolean(currentUserId && e.bidderId === currentUserId),
    timestamp: e.at,
  }));
}

export function mapAuctionSessionHeaderVM(args: {
  saleTitle: string;
  lot: Lot;
  paddleNumber?: string | null;
  userVerified?: boolean;
}): AuctionSessionHeaderVM {
  const lotNo =
    args.lot.lotNumber != null
      ? args.lot.lotNumber
      : args.lot.id.replace(/-/g, "").slice(0, 4).toUpperCase();
  return {
    saleTitle: args.saleTitle,
    lotLabel: `Lot ${lotNo} — ${args.lot.title}`,
    paddleNumber: args.paddleNumber ?? null,
    userVerified: args.userVerified ?? false,
  };
}
