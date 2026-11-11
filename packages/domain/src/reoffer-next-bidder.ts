import { MAX_REOFFERS_PER_DEFAULT } from "./reoffer-rules.js";

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

/** Someone already offered the lot in this default (an earlier offer, in any state). */
export type OfferedParty = { userId: string; legalEntityId: string };

export type SkipReason = "suspended" | "closed" | "deletion_pending" | "already_offered";

export type SkippedBidder = {
  userId: string;
  legalEntityId: string;
  amountMinor: number;
  reason: SkipReason;
};

export type NextBidder = { userId: string; legalEntityId: string; amountMinor: number };

export type NextBidderResult =
  | { kind: "found"; bidder: NextBidder; skipped: SkippedBidder[] }
  | {
      kind: "none";
      reason: "offer_limit_reached" | "no_other_bidder" | "no_eligible_bidder";
      skipped: SkippedBidder[];
    };

const ACCOUNT_SKIP: Record<Exclude<BidderAccountState, "active">, SkipReason> = {
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
 * same buyer), at that bid and nothing else. Bidders already offered are passed over, as are
 * suspended, closed and deletion-pending accounts; each is returned once, with its reason, to be
 * recorded. At most three offers are made per default.
 */
export function selectNextBidder(input: {
  bids: readonly PlacedBid[];
  defaultingBuyer: OfferedParty;
  alreadyOffered: readonly OfferedParty[];
}): NextBidderResult {
  if (input.alreadyOffered.length >= MAX_REOFFERS_PER_DEFAULT) {
    return { kind: "none", reason: "offer_limit_reached", skipped: [] };
  }
  const others = input.bids
    .filter((bid) => !sharesParty(bid, input.defaultingBuyer))
    .sort(byBidOrder);
  if (others.length === 0) return { kind: "none", reason: "no_other_bidder", skipped: [] };

  const skipped: SkippedBidder[] = [];
  const passedOver: PlacedBid[] = [];
  for (const bid of others) {
    // A party's lower bids are not considered again once its highest was passed over.
    if (passedOver.some((seen) => sharesParty(bid, seen))) continue;
    const reason = skipReason(bid, input.alreadyOffered);
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

function skipReason(bid: PlacedBid, offered: readonly OfferedParty[]): SkipReason | null {
  if (offered.some((party) => sharesParty(bid, party))) return "already_offered";
  return bid.accountState === "active" ? null : ACCOUNT_SKIP[bid.accountState];
}
