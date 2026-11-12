import type { ReofferStatus } from "@auction/domain";
import type { StaffBuyerDefault } from "@auction/validators";
import type { LotReofferBundle } from "./reoffer-bundle";

export type BidStanding = { label: string; tone: "neutral" | "info" | "success" | "danger" };

/**
 * How a bid reads on the Bidding tab once an offer has been made, by the state of the offer made
 * at that bid. A state without an entry leaves the bid as it was: a withdrawn offer or a seller's
 * no changes nothing about the bid itself.
 */
const BY_OFFER_STATUS: Partial<Record<ReofferStatus, BidStanding>> = {
  awaiting_seller: { label: "Next in line", tone: "info" },
  ready: { label: "Next in line", tone: "info" },
  offered: { label: "Offered", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  expired: { label: "Offer ended", tone: "neutral" },
};

const DEFAULTED: BidStanding = { label: "Defaulted", tone: "danger" };

type BidRef = { id: string; bidderId: string | null; amount: string };

/** A pounds string ("88000.00") as whole pence, for comparing with the default's hammer. */
function toPence(amount: string): number {
  return Math.round(Number.parseFloat(amount) * 100);
}

/**
 * The standing of each bid that an offer or the default changed, keyed by bid id; a bid not in
 * the result keeps the standing the tab already gives it. The defaulted bid is the buyer's bid at
 * the original hammer, the first such bid when there are several.
 */
export function bidStandings(
  bundle: LotReofferBundle,
  bids: readonly BidRef[],
): Record<string, BidStanding> {
  if (bundle.status !== "ready" || !bundle.buyerDefault) return {};
  const standings: Record<string, BidStanding> = {};
  const defaulted = defaultedBid(bundle.buyerDefault, bids);
  if (defaulted) standings[defaulted.id] = DEFAULTED;
  for (const offer of bundle.offers) {
    const standing = BY_OFFER_STATUS[offer.status];
    if (standing && bids.some((bid) => bid.id === offer.sourceBidId)) {
      standings[offer.sourceBidId] = standing;
    }
  }
  return standings;
}

function defaultedBid(buyerDefault: StaffBuyerDefault, bids: readonly BidRef[]): BidRef | null {
  return (
    bids.find(
      (bid) =>
        bid.bidderId === buyerDefault.buyerUserId &&
        toPence(bid.amount) === buyerDefault.originalHammerMinor,
    ) ?? null
  );
}
