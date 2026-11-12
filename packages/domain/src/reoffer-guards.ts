import type { LotStatus, PaymentStatus } from "@auction/types";
import { canTransition } from "./lot-transitions.js";
import { type ReofferBlock, type ReofferBlockCode, reawardBlock } from "./reoffer-eligibility.js";
import type { ReofferRecord, ReofferStatus } from "./reoffer-state.js";

export type ReofferSendBlockCode =
  | ReofferBlockCode
  | "offer_superseded"
  | "lot_not_reawardable"
  | "lot_has_buyer";

export type ReofferSendBlock = { code: ReofferSendBlockCode; message: string };

export type ReofferSendFacts = {
  /** The lot as read under its row lock. */
  lot: { status: LotStatus; winnerId: string | null };
  /** The lot's most recent buyer default, and the default the offer answers. */
  latestDefaultId: string | null;
  offerDefaultId: string;
  /** Every payment on the lot, whatever its state. */
  payments: readonly { status: PaymentStatus }[];
  /** The default's other offers. */
  otherOffers: readonly ReofferRecord[];
};

function refuse(code: ReofferSendBlockCode, message: string): ReofferSendBlock {
  return { code, message };
}

/**
 * Whether an offer may still go out to its bidder. Sending is a promise the lot can be won
 * through the offer, so it is refused on the same grounds that would later refuse the re-award:
 * a payment that is paid, being paid or held, another accepted offer, a buyer on the lot again, or
 * a later default. Evaluated under the lot's row lock, as late as possible.
 */
export function reofferSendBlock(facts: ReofferSendFacts): ReofferSendBlock | null {
  if (facts.latestDefaultId !== facts.offerDefaultId) {
    return refuse(
      "offer_superseded",
      "The lot defaulted again after this offer was made, so it no longer applies.",
    );
  }
  if (!canTransition(facts.lot.status, "reaward")) {
    return refuse("lot_not_reawardable", "The lot is no longer waiting for a buyer.");
  }
  if (facts.lot.winnerId !== null) {
    return refuse("lot_has_buyer", "The lot has a buyer again, so it cannot be offered on.");
  }
  const block: ReofferBlock | null = reawardBlock({
    payments: facts.payments,
    otherOffers: facts.otherOffers,
  });
  return block;
}

export type ReofferResponseBlockCode = "offer_not_open" | "offer_window_ended";

/**
 * Whether a bidder may still answer an offer. Only an offer that is out can be answered, and only
 * until its end: the clock closing it later changes the record, never the bidder's right to a
 * window that had already ended.
 */
export function reofferResponseBlock(
  offer: { status: ReofferStatus; offerEndsAt: Date | null },
  now: Date,
): { code: ReofferResponseBlockCode; message: string } | null {
  if (offer.status !== "offered") {
    return { code: "offer_not_open", message: "This offer is no longer open." };
  }
  if (offer.offerEndsAt === null || now.getTime() >= offer.offerEndsAt.getTime()) {
    return { code: "offer_window_ended", message: "The time to answer this offer has ended." };
  }
  return null;
}
