import type { PaymentStatus } from "@auction/types";
import { paymentIsSettling } from "./buyer-default.js";
import { MAX_REOFFERS_PER_DEFAULT } from "./reoffer-rules.js";

export type ReofferBlockCode =
  | "sold_on_atg"
  | "buyer_default_not_recorded"
  | "payment_in_progress"
  | "open_offer_exists"
  | "offer_limit_reached";

export type ReofferBlock = { code: ReofferBlockCode; message: string };

export type ReofferStartFacts = {
  /** The lot was sold on ATG: it has no LAX winner or bids. */
  soldOnAtg: boolean;
  /** A buyer default is recorded and the lot is waiting for what comes next. */
  buyerDefaultRecorded: boolean;
  /** The lot's current invoice, or `null` when none stands. */
  payment: { status: PaymentStatus } | null;
  openOfferCount: number;
  offersMadeCount: number;
};

const MESSAGES: Record<ReofferBlockCode, string> = {
  sold_on_atg: "Sold on ATG: follow the ATG settlement runbook.",
  buyer_default_not_recorded: "Record the buyer default before offering the lot again.",
  payment_in_progress: "The buyer has paid or is paying. A paid lot cannot be re-awarded.",
  open_offer_exists: "An offer for this lot is still open.",
  offer_limit_reached: "Three offers have been made. Return the lot to inventory.",
};

function block(code: ReofferBlockCode): ReofferBlock {
  return { code, message: MESSAGES[code] };
}

/** Why a re-offer cannot be started for this lot, or `null` when it can. */
export function reofferStartBlock(facts: ReofferStartFacts): ReofferBlock | null {
  if (facts.soldOnAtg) return block("sold_on_atg");
  if (!facts.buyerDefaultRecorded) return block("buyer_default_not_recorded");
  if (facts.payment && paymentIsSettling(facts.payment.status)) return block("payment_in_progress");
  if (facts.openOfferCount > 0) return block("open_offer_exists");
  if (facts.offersMadeCount >= MAX_REOFFERS_PER_DEFAULT) return block("offer_limit_reached");
  return null;
}

/**
 * Whether the lot can still be re-awarded when the bidder accepts. A lot that is paid or being
 * paid is never awarded again, whatever state the offer is in.
 */
export function reawardBlock(payment: { status: PaymentStatus } | null): ReofferBlock | null {
  return payment && paymentIsSettling(payment.status) ? block("payment_in_progress") : null;
}
