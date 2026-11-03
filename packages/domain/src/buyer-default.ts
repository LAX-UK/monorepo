import type { LotStatus, PaymentStatus } from "@auction/types";
import { canTransition } from "./lot-transitions.js";

/** Where the lot goes once the buyer's sale is cancelled. */
export const BUYER_DEFAULT_OUTCOMES = ["returned_to_inventory", "offered_to_underbidder"] as const;
export type BuyerDefaultOutcome = (typeof BUYER_DEFAULT_OUTCOMES)[number];

/** The bidder who would be next in line: the highest bid from someone other than the buyer. */
export type Underbidder = { userId: string; legalEntityId: string; amount: string };

export type BuyerDefaultFacts = {
  lotStatus: LotStatus;
  winnerId: string | null;
  /** The invoice for the won lot (latest row), or `null` while none is raised. */
  payment: { status: PaymentStatus } | null;
  fulfilmentStatus: string | null;
  hasOpenDispute: boolean;
  underbidder?: Underbidder | null;
};

export type BuyerDefaultBlockCode =
  | "not_ended"
  | "no_winner"
  | "payment_in_progress"
  | "held_for_checks"
  | "open_dispute"
  | "delivery_started"
  | "already_cancelled"
  | "no_underbidder";

export type BuyerDefaultBlock = { code: BuyerDefaultBlockCode; message: string };

const SETTLING: readonly PaymentStatus[] = ["authorized", "captured", "refunded"];
const DELIVERY_NOT_STARTED: readonly (string | null)[] = [null, "awaiting_payment"];

/**
 * Why a buyer default cannot be recorded for this lot, or `null` when it can. A default cancels
 * an unpaid sale: it never applies once money has moved, while LAX itself is holding the payment
 * for checks (the buyer is not at fault), or once delivery has begun.
 */
export function buyerDefaultBlock(
  facts: BuyerDefaultFacts,
  outcome: BuyerDefaultOutcome,
): BuyerDefaultBlock | null {
  if (!canTransition(facts.lotStatus, "buyer_default")) {
    return {
      code: "not_ended",
      message: "Only a lot that has ended can be marked as a buyer default.",
    };
  }
  if (!facts.winnerId) {
    return { code: "no_winner", message: "This lot has no buyer to mark as defaulted." };
  }
  if (facts.fulfilmentStatus === "cancelled") {
    return { code: "already_cancelled", message: "This sale has already been cancelled." };
  }
  if (facts.payment && facts.payment.status === "requires_manual_review") {
    return {
      code: "held_for_checks",
      message:
        "The payment is held for our own checks. Finish the review before marking a default.",
    };
  }
  if (facts.payment && SETTLING.includes(facts.payment.status)) {
    return {
      code: "payment_in_progress",
      message: "The buyer has paid or is paying. Refund the payment instead of marking a default.",
    };
  }
  if (facts.hasOpenDispute) {
    return { code: "open_dispute", message: "A payment dispute is open on this lot." };
  }
  if (!DELIVERY_NOT_STARTED.includes(facts.fulfilmentStatus)) {
    return { code: "delivery_started", message: "Delivery of this lot has already started." };
  }
  if (outcome === "offered_to_underbidder" && !facts.underbidder) {
    return { code: "no_underbidder", message: "No other bidder bid on this lot to offer it to." };
  }
  return null;
}

/**
 * The highest bid placed by anyone other than the buyer's account. Amounts are decimal strings;
 * they are compared as numbers.
 */
export function pickUnderbidder(
  bids: readonly Underbidder[],
  buyerLegalEntityId: string,
): Underbidder | null {
  let best: Underbidder | null = null;
  for (const bid of bids) {
    if (bid.legalEntityId === buyerLegalEntityId) continue;
    if (!best || Number(bid.amount) > Number(best.amount)) best = bid;
  }
  return best;
}
