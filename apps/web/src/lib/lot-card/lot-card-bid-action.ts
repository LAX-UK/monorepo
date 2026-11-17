import { lotBidHref } from "@/lib/lot-card/lot-bid-href";
import { LOT_CARD_COPY } from "@/lib/lot-card/lot-card-copy";
import { lotShowsBidAction } from "@/lib/lot/lot-bid-action";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import type { LotStatus, Sale } from "@auction/types";
import { isSaleroomGatedForOnlineBids } from "@auction/validators";

/**
 * What a lot card's full-width button does for the person looking. The label always names what
 * the button does: it never says "Bid" on a lot that is not open yet, and never offers a bid the
 * lot page would refuse.
 */
export type LotCardBidAction =
  | { kind: "bid" | "register" | "leave_bid"; label: string; href: string }
  /** The viewer is not known yet; the button's place is kept so the grid does not move. */
  | { kind: "pending" };

/** Who is looking, as far as the button needs to know; `null` until the viewer read answers. */
export type LotCardBidViewer = {
  signedIn: boolean;
  /**
   * The sale page's own register step for this person (`salePrimaryViewerAction`), or `null`
   * when they have nothing left to do before bidding (registered, or a collector who needs no
   * registration).
   */
  register: { href: string } | null;
} | null;

export type LotCardBidActionInput = {
  lotStatus: LotStatus;
  lotHref: string;
  /** The lot's sale; without it the card cannot tell whether advance bids are taken. */
  sale:
    | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
    | null;
  viewer: LotCardBidViewer;
};

/** The sale takes web bids on a lot before it opens (a maximum left in advance). */
export function saleAcceptsAdvanceBids(sale: LotCardBidActionInput["sale"]): boolean {
  if (!sale) return false;
  return saleAllowsWebBidding(sale.deliveryMode) && !isSaleroomGatedForOnlineBids(sale);
}

/**
 * - Open lot: "Bid", to the lot page.
 * - Before it opens and the viewer has a register step: "Register to bid", to that step.
 * - Before it opens, nothing left to do and the sale takes advance bids: "Leave a bid", to the lot
 *   page with the bid dialog open (where the maximum is left).
 * - Otherwise no button: an ended lot is a result, and a lot that takes no bid yet offers none.
 */
export function lotCardBidAction(input: LotCardBidActionInput): LotCardBidAction | null {
  const { lotStatus, lotHref, sale, viewer } = input;
  if (!lotShowsBidAction(lotStatus)) return null;
  if (lotStatus === "active") return { kind: "bid", label: LOT_CARD_COPY.bid, href: lotHref };
  if (viewer === null) return { kind: "pending" };
  if (viewer.register) {
    return { kind: "register", label: LOT_CARD_COPY.registerToBid, href: viewer.register.href };
  }
  const opensLater = lotStatus === "scheduled" && sale?.status !== "draft";
  if (viewer.signedIn && opensLater && saleAcceptsAdvanceBids(sale)) {
    return { kind: "leave_bid", label: LOT_CARD_COPY.leaveABid, href: lotBidHref(lotHref) };
  }
  return null;
}
