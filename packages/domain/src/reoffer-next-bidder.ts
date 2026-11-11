import { type ReofferRecord, capReached, offerReachedBidder } from "./reoffer-state.js";

/** The standing of a bidder's account, as far as being offered a lot goes. */
export type BidderAccountState = "active" | "suspended" | "closed" | "deletion_pending";

/** A bid that was actually placed. The hidden auto-bid maximum is never one of these. */
export type PlacedBid = {
  userId: string;
  legalEntityId: string;
  amountMinor: number;
  placedAt: Date;
  accountState: BidderAccountState;
};

/** A party in a bid or an offer: the person and the account. */
export type OfferedParty = { userId: string; legalEntityId: string };

/** An earlier offer of this lot in this default, to whom, and how it stands. */
export type PriorOffer = OfferedParty & ReofferRecord;

/** Why an otherwise eligible bidder was passed over, to be recorded. */
export type ReofferSkipReason = "suspended" | "closed" | "deletion_pending";

export type SkippedBidder = {
  userId: string;
  legalEntityId: string;
  amountMinor: number;
  reason: ReofferSkipReason;
};

export type NextBidder = { userId: string; legalEntityId: string; amountMinor: number };

export type NextBidderResult =
  | { kind: "found"; bidder: NextBidder; skipped: SkippedBidder[] }
  | {
      kind: "none";
      reason: "offer_limit_reached" | "no_other_bidder" | "no_eligible_bidder";
      skipped: SkippedBidder[];
    };

const ACCOUNT_SKIP: Record<Exclude<BidderAccountState, "active">, ReofferSkipReason> = {
  suspended: "suspended",
  closed: "closed",
  deletion_pending: "deletion_pending",
};

function sharesParty(bid: PlacedBid, party: OfferedParty): boolean {
  return bid.userId === party.userId || bid.legalEntityId === party.legalEntityId;
}

/** Highest bid first; an earlier bid wins a tie, then the ids keep the order stable. */
function byBidOrder(a: PlacedBid, b: PlacedBid): number {
  return (
    b.amountMinor - a.amountMinor ||
    a.placedAt.getTime() - b.placedAt.getTime() ||
    a.userId.localeCompare(b.userId) ||
    a.legalEntityId.localeCompare(b.legalEntityId)
  );
}

/**
 * Who the lot is offered to next. The bidder is the highest placed bid from an account and a
 * person other than the defaulting buyer (a person bidding for another account counts as the
 * same buyer), at that bid and nothing else.
 *
 * Bidders who were already offered the lot are left out without a record, and so are all their
 * other bids. Only offers that reached a bidder count (an offer the seller refused or let lapse,
 * or that was withdrawn before it was sent, did not), and at most three are made per default.
 * Suspended, closed and deletion-pending accounts are passed over and returned once, with the
 * reason, to be recorded. A person's lower bid under another account is collapsed into that
 * person's highest: when the highest is passed over, the lower one is not tried.
 */
export function selectNextBidder(input: {
  bids: readonly PlacedBid[];
  defaultingBuyer: OfferedParty;
  alreadyOffered: readonly PriorOffer[];
}): NextBidderResult {
  if (capReached(input.alreadyOffered)) {
    return { kind: "none", reason: "offer_limit_reached", skipped: [] };
  }
  const offered = input.alreadyOffered.filter(offerReachedBidder);
  const others = input.bids
    .filter((bid) => !sharesParty(bid, input.defaultingBuyer))
    .filter((bid) => !offered.some((party) => sharesParty(bid, party)))
    .sort(byBidOrder);
  if (others.length === 0) return { kind: "none", reason: "no_other_bidder", skipped: [] };

  const skipped: SkippedBidder[] = [];
  const passedOver: PlacedBid[] = [];
  for (const bid of others) {
    if (passedOver.some((seen) => sharesParty(bid, seen))) continue;
    const reason = accountSkipReason(bid.accountState);
    if (!reason) {
      const { userId, legalEntityId, amountMinor } = bid;
      return { kind: "found", bidder: { userId, legalEntityId, amountMinor }, skipped };
    }
    passedOver.push(bid);
    skipped.push({
      userId: bid.userId,
      legalEntityId: bid.legalEntityId,
      amountMinor: bid.amountMinor,
      reason,
    });
  }
  return { kind: "none", reason: "no_eligible_bidder", skipped };
}

function accountSkipReason(state: BidderAccountState): ReofferSkipReason | null {
  return state === "active" ? null : ACCOUNT_SKIP[state];
}
