import { type LotDetailsView, buildLotDetails, lotFactsLine } from "@/lib/lot-page/lot-details";
import type { LotViewerView } from "@/lib/lot-page/lot-viewer";
import type { LotPageLot, LotPageViewSource } from "@/lib/lot-page/use-lot-page-view";
import { lotBuyerPremiumCopy, termsBuyerPremiumCopy } from "@/lib/lot/buyer-premium-copy";
import { salePath } from "@/lib/seo/url";
import {
  type BuyersPremiumTerms,
  DEFAULT_LOT_MEDIA_TREATMENT,
  type LotMediaTreatment,
} from "@auction/domain";
import type { GalleryImage, Lot, PublicLotView, Sale, WithSaleZone } from "@auction/types";
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
  /** The premium the lot charges, in words ("15% up to £500,000, then 10% on the part above"); null when not for sale. */
  premiumTerms: string | null;
  sale: { href: string; label: string };
  initialWatching: boolean;
  /** How the lot's department presents its pictures. */
  media: LotMediaTreatment;
};

export type LotTemplateInput = {
  auction: WithSaleZone<Lot | PublicLotView>;
  lotPath: string;
  shareUrl: string;
  saleLifecycle: SalePick;
  parentSale: { id: string; title: string } | null;
  signedIn: boolean;
  watching: boolean;
  artist: LotTemplateData["artist"];
  documents: Array<{ label: string; href: string }>;
  /** The premium terms the lot charges (catalogue terms, not bid state). */
  buyersPremium: BuyersPremiumTerms | null;
  viewer: LotViewerView | null;
  /** Left out, the lot is shown as a wall work. */
  media?: LotMediaTreatment;
};

const NOT_FOR_SALE: ReadonlySet<Lot["status"]> = new Set(["voided", "cancelled"]);

/** The premium in words: the server's resolved terms when it sent them, else the lot's own. */
function premiumTermsOf(
  auction: WithSaleZone<Lot | PublicLotView>,
  buyersPremium: BuyersPremiumTerms | null,
): string | null {
  const copy = buyersPremium ? termsBuyerPremiumCopy(buyersPremium) : lotBuyerPremiumCopy(auction);
  return copy?.terms ?? null;
}

/**
 * The lot's catalogue facts for the page. Nothing bidding moves is copied (price, status, close,
 * winner, result, reserve met): the page is built from cached reads (CO-7), so those come only
 * from the live read in the browser.
 */
function pageLotOf(auction: WithSaleZone<Lot | PublicLotView>): LotPageLot {
  return {
    id: auction.id,
    auctionType: auction.auctionType,
    startingPrice: auction.startingPrice,
    minBidIncrement: auction.minBidIncrement,
    marketingDetails: auction.marketingDetails,
    startTime: new Date(auction.startTime).toISOString(),
    ...(auction.timeZone ? { timeZone: auction.timeZone } : {}),
    ...("hasReserve" in auction ? { hasReserve: auction.hasReserve } : {}),
  };
}

/** Maps the loaded lot page onto the template's inputs. Pure, so each mapping is a test. */
export function toLotTemplateData(input: LotTemplateInput): LotTemplateData {
  const { auction } = input;
  return {
    source: {
      lot: pageLotOf(auction),
      sale: input.saleLifecycle,
      signedIn: input.signedIn,
      initialViewer: input.viewer,
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
    premiumTerms: NOT_FOR_SALE.has(auction.status)
      ? null
      : premiumTermsOf(auction, input.buyersPremium),
    sale: input.parentSale
      ? { href: salePath(input.parentSale), label: "Back to the sale" }
      : { href: "/search", label: "Search lots" },
    initialWatching: input.watching,
    media: input.media ?? DEFAULT_LOT_MEDIA_TREATMENT,
  };
}
