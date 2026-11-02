import type { LotBiddingView } from "@/lib/lot-page/lot-bidding-view";
import { type LotDetailsView, buildLotDetails, lotFactsLine } from "@/lib/lot-page/lot-details";
import type { LotViewerView } from "@/lib/lot-page/lot-viewer";
import type { LotPageLot, LotPageViewSource } from "@/lib/lot-page/use-lot-page-view";
import { salePath } from "@/lib/seo/url";
import type { PublicBidHistory } from "@auction/domain";
import type { GalleryImage, Lot, PublicLotView, Sale } from "@auction/types";
import { toGalleryImages } from "@auction/types";

type SalePick =
  | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
  | null;

/** What the lot template draws, minus the bid entry (which the page supplies as an element). */
export type LotTemplateData = {
  source: LotPageViewSource;
  lot: {
    id: string;
    title: string;
    lotNumber: number | null;
    images: GalleryImage[];
    path: string;
    shareUrl: string;
  };
  artist: { id: string; name: string; href: string; lifespan: string | null } | null;
  factsLine: string | null;
  details: LotDetailsView;
  premiumPercent: string | null;
  sale: { href: string; label: string };
  initialWatching: boolean;
};

export type LotTemplateInput = {
  auction: Lot | PublicLotView;
  lotPath: string;
  shareUrl: string;
  saleLifecycle: SalePick;
  parentSale: { id: string; title: string } | null;
  signedIn: boolean;
  watching: boolean;
  artist: LotTemplateData["artist"];
  documents: Array<{ label: string; href: string }>;
  bidding: LotBiddingView;
  viewer: LotViewerView | null;
  history: PublicBidHistory | null;
};

const NOT_FOR_SALE: ReadonlySet<Lot["status"]> = new Set(["voided", "cancelled"]);

/** "25%": the buyer's premium rate as the page prints it; whole percentages stay whole. */
function premiumPercentOf(rate: string): string | null {
  const value = Number.parseFloat(rate) * 100;
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${Number(value.toFixed(2))}%`;
}

function pageLotOf(auction: Lot | PublicLotView): LotPageLot {
  return {
    id: auction.id,
    status: auction.status,
    auctionType: auction.auctionType,
    startingPrice: auction.startingPrice,
    currentPrice: auction.currentPrice,
    minBidIncrement: auction.minBidIncrement,
    winnerId: auction.winnerId,
    hasWinner: auction.hasWinner,
    marketingDetails: auction.marketingDetails,
    startTime: new Date(auction.startTime).toISOString(),
    endTime: new Date(auction.endTime).toISOString(),
    ...("hasReserve" in auction
      ? { hasReserve: auction.hasReserve, reserveMet: auction.reserveMet }
      : {}),
  };
}

/** Maps the loaded lot page onto the template's inputs. Pure, so each mapping is a test. */
export function toLotTemplateData(input: LotTemplateInput): LotTemplateData {
  const { auction } = input;
  return {
    source: {
      lot: pageLotOf(auction),
      bidding: input.bidding,
      sale: input.saleLifecycle,
      signedIn: input.signedIn,
      initialViewer: input.viewer,
      initialHistory: input.history,
    },
    lot: {
      id: auction.id,
      title: auction.title,
      lotNumber: auction.lotNumber,
      images: toGalleryImages(
        auction.images,
        auction.marketingDetails.imageAlts,
        auction.title,
        auction.imageAssets,
      ),
      path: input.lotPath,
      shareUrl: input.shareUrl,
    },
    artist: input.artist,
    factsLine: lotFactsLine(auction),
    details: buildLotDetails({
      description: auction.description,
      marketingDetails: auction.marketingDetails,
      documents: input.documents,
    }),
    premiumPercent: NOT_FOR_SALE.has(auction.status)
      ? null
      : premiumPercentOf(auction.buyerPremiumRate),
    sale: input.parentSale
      ? { href: salePath(input.parentSale), label: "Back to the sale" }
      : { href: "/search", label: "Search lots" },
    initialWatching: input.watching,
  };
}
