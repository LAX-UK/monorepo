import type { PaymentStatus } from "@auction/types";
import { paymentIsPaidOrBeingPaid } from "./buyer-default.js";
import {
  type ReofferRecord,
  capReached,
  isOpenReofferStatus,
  reofferProgress,
} from "./reoffer-state.js";

export type ReofferBlockCode =
  | "sold_on_atg"
  | "buyer_default_not_recorded"
  | "payment_in_progress"
  | "already_re_offered"
  | "open_offer_exists"
  | "seller_declined_last_offer"
  | "offer_limit_reached";

export type ReofferBlock = { code: ReofferBlockCode; message: string };

export type ReofferStartFacts = {
  /** The lot was sold on ATG: it has no LAX winner or bids. */
  soldOnAtg: boolean;
  /** A buyer default is recorded and the lot is waiting for what comes next. */
  buyerDefaultRecorded: boolean;
  /** Every payment on the lot, whatever its state. */
  payments: readonly { status: PaymentStatus }[];
  /** The offers made so far in this default, in the order they were made. */
  offers: readonly ReofferRecord[];
};

const MESSAGES: Record<ReofferBlockCode, string> = {
  sold_on_atg: "Sold on ATG: follow the ATG settlement runbook.",
  buyer_default_not_recorded: "Record the buyer default before offering the lot again.",
  payment_in_progress:
    "A payment on this lot is paid, being paid or held. It cannot be re-awarded.",
  already_re_offered: "A bidder has already accepted an offer for this lot.",
  open_offer_exists: "An offer for this lot is still open.",
  seller_declined_last_offer:
    "The seller declined or did not reply to the last offer. Record their answer on that request, return the lot to inventory, or follow the seller's preference.",
  offer_limit_reached: "Three offers have been made. Return the lot to inventory.",
};

function block(code: ReofferBlockCode): ReofferBlock {
  return { code, message: MESSAGES[code] };
}

/** Whether any payment on the lot is paid, being paid or held with the money taken. */
function hasPaidPayment(payments: readonly { status: PaymentStatus }[]): boolean {
  return payments.some((payment) => paymentIsPaidOrBeingPaid(payment.status));
}

/** Why a re-offer cannot be started for this lot, or `null` when it can. */
export function reofferStartBlock(facts: ReofferStartFacts): ReofferBlock | null {
  if (facts.soldOnAtg) return block("sold_on_atg");
  if (!facts.buyerDefaultRecorded) return block("buyer_default_not_recorded");
  if (hasPaidPayment(facts.payments)) return block("payment_in_progress");
  if (facts.offers.some((offer) => isOpenReofferStatus(offer.status))) {
    return block("open_offer_exists");
  }
  const progress = reofferProgress(facts.offers);
  if (progress.kind === "re_offered") return block("already_re_offered");
  if (capReached(facts.offers)) return block("offer_limit_reached");
  if (progress.kind === "needs_decision" && !progress.canOfferAgain) {
    return block("seller_declined_last_offer");
  }
  return null;
}

/**
 * Whether the lot can still be re-awarded when a bidder accepts. A lot with any payment that is
 * paid, being paid or held is never awarded again, and neither is a lot another offer of the
 * default has already been accepted for. `otherOffers` are the default's other offers.
 */
export function reawardBlock(input: {
  payments: readonly { status: PaymentStatus }[];
  otherOffers: readonly ReofferRecord[];
}): ReofferBlock | null {
  if (hasPaidPayment(input.payments)) return block("payment_in_progress");
  if (input.otherOffers.some((offer) => offer.status === "accepted")) {
    return block("already_re_offered");
  }
  return null;
}
