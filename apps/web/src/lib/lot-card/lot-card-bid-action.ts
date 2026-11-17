import { lotBidHref } from "@/lib/lot-card/lot-bid-href";
import { LOT_CARD_COPY } from "@/lib/lot-card/lot-card-copy";
import { lotShowsBidAction } from "@/lib/lot/lot-bid-action";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import { saleLifecycleActions } from "@/lib/sale/sale-lifecycle-actions";
import type { LotStatus, Sale } from "@auction/types";
import { isSaleroomGatedForOnlineBids } from "@auction/validators";

/**
 * What a lot card's full-width button does for the person looking. The label always names what
 * the button does: it never says "Bid" on a lot that is not open yet, never offers a bid the lot
 * page would refuse, and a register step is named exactly as the sale page's hero names it.
 */
export type LotCardBidAction =
  | { kind: "bid" | "register" | "leave_bid"; label: string; href: string }
  /** The viewer is not known yet; the button's place is kept so the grid does not move. */
  | { kind: "pending" };

/** The step the sale page asks this person to take before bidding: label and link, as the hero. */
export type LotCardRegisterStep = { href: string; label: string };

/** Who is looking, as far as the button needs to know; `null` until the viewer read answers. */
export type LotCardBidViewer = {
  signedIn: boolean;
  /**
   * The sale page's own register step for this person (`salePrimaryViewerAction`): "Register to
   * bid", "Verify identity to bid", "Set up a buyer profile"... The card shows its label as is, so
   * the card and the hero always say the same thing. `null` when they have nothing left to do
   * before bidding (registered, or a collector who needs no registration).
   */
  register: LotCardRegisterStep | null;
} | null;

export type LotCardBidSale = Pick<Sale, "status" | "deliveryMode"> &
  Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">> & {
    /**
     * The sale takes web registrations now (`registerToBidSale`): the flag the hero's register
     * step starts from. Left out, the card assumes it may.
     */
    registrationOffered?: boolean;
  };

export type LotCardBidActionInput = {
  lotStatus: LotStatus;
  lotHref: string;
  /**
   * The lot's sale. Without it (search, home, artist and department grids, which show lots from
   * many sales) the card cannot know a register step or whether advance bids are taken, so it
   * offers only "Bid" on an open lot.
   */
  sale: LotCardBidSale | null;
  viewer: LotCardBidViewer;
};

/** The sale takes web bids on a lot before it opens (a maximum left in advance). */
export function saleAcceptsAdvanceBids(sale: LotCardBidActionInput["sale"]): boolean {
  if (!sale) return false;
  return saleAllowsWebBidding(sale.deliveryMode) && !isSaleroomGatedForOnlineBids(sale);
}

/** The hero could ask someone to register for this sale (the presenter's own sale-level checks). */
function saleMayAskToRegister(sale: LotCardBidSale): boolean {
  return (
    sale.registrationOffered !== false &&
    saleAllowsWebBidding(sale.deliveryMode) &&
    saleLifecycleActions(sale.status).register
  );
}

/** A registered viewer could leave a bid on this lot before it opens. */
function lotMayTakeAdvanceBid(lotStatus: LotStatus, sale: LotCardBidSale): boolean {
  return lotStatus === "scheduled" && sale.status !== "draft" && saleAcceptsAdvanceBids(sale);
}

/**
 * - Open lot: "Bid", to the lot page.
 * - Before it opens and the viewer has a register step: that step's own label and link, as the
 *   hero shows it ("Register to bid", "Verify identity to bid", "Set up a buyer profile").
 * - Before it opens, nothing left to do and the sale takes advance bids: "Leave a bid", to the lot
 *   page with its bid dialog open (`lotBidHref`), where the maximum is left.
 * - Otherwise no button: an ended lot is a result, and a lot that takes no bid yet offers none. A
 *   sale that could never offer either step (onsite, gated before go-live, no web registration)
 *   answers before the viewer read, so its cards never draw a placeholder that then vanishes.
 */
export function lotCardBidAction(input: LotCardBidActionInput): LotCardBidAction | null {
  const { lotStatus, lotHref, sale, viewer } = input;
  if (!lotShowsBidAction(lotStatus)) return null;
  if (lotStatus === "active") return { kind: "bid", label: LOT_CARD_COPY.bid, href: lotHref };
  if (!sale) return null;
  const mayRegister = saleMayAskToRegister(sale);
  const mayLeaveBid = lotMayTakeAdvanceBid(lotStatus, sale);
  if (!mayRegister && !mayLeaveBid) return null;
  if (viewer === null) return { kind: "pending" };
  if (viewer.register && mayRegister) {
    return { kind: "register", label: viewer.register.label, href: viewer.register.href };
  }
  if (viewer.signedIn && mayLeaveBid) {
    return { kind: "leave_bid", label: LOT_CARD_COPY.leaveABid, href: lotBidHref(lotHref) };
  }
  return null;
}
