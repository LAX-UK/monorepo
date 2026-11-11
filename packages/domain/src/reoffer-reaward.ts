import type { LotStatus, PaymentStatus } from "@auction/types";
import { canTransition } from "./lot-transitions.js";
import { type ReofferBlock, reawardBlock } from "./reoffer-eligibility.js";
import type { ReofferRecord, ReofferStatus } from "./reoffer-state.js";

export type ReawardGuardCode =
  | "lot_not_reawardable"
  | "lot_has_buyer"
  | "offer_not_accepted"
  | "offer_not_for_lot"
  | "offer_superseded"
  | "offer_bid_mismatch"
  | ReofferBlock["code"];

export type ReawardGuard = { ok: true } | { ok: false; code: ReawardGuardCode; message: string };

export type ReawardGuardFacts = {
  /** The lot as read under its row lock. */
  lot: { id: string; status: LotStatus; winnerId: string | null };
  /**
   * The offer being awarded, read in the same transaction. `respondedAt` is when the bidder
   * accepted: it becomes the moment the lot was won again. `buyerDefaultId` is the default it
   * answers.
   */
  offer: {
    lotId: string;
    buyerDefaultId: string;
    status: ReofferStatus;
    respondedAt: Date | null;
    /** The bid the offer was made from, and what it says about the lot, bidder and amount. */
    sourceBid: {
      lotId: string;
      bidderId: string;
      legalEntityId: string | null;
      amountPence: number;
    } | null;
    offeredUserId: string;
    offeredLegalEntityId: string;
    amountPence: number;
  };
  /**
   * The lot's most recent buyer default, whichever offer it led to. An offer answers one default:
   * once the lot has defaulted again, the earlier default's offers are history and never award.
   */
  latestDefault: { id: string; lotId: string } | null;
  /** Every payment on the lot, whatever its state. */
  payments: readonly { status: PaymentStatus }[];
  /** The default's other offers. */
  otherOffers: readonly ReofferRecord[];
};

function refuse(code: ReawardGuardCode, message: string): ReawardGuard {
  return { ok: false, code, message };
}

/**
 * Whether the lot may be re-awarded to the bidder who accepted. The lot's `reaward` transition
 * runs only from an accepted offer of this lot, and only while no payment on the lot is paid,
 * being paid or held, no other offer of the default has been accepted, and the lot has no buyer
 * (the default took the winner off), and only while the offer answers the lot's latest default
 * and matches its source bid. Evaluated again under the lot's row lock, whatever was checked when the bidder pressed accept.
 */
export function reawardGuard(facts: ReawardGuardFacts): ReawardGuard {
  if (facts.offer.lotId !== facts.lot.id) {
    return refuse("offer_not_for_lot", "This offer belongs to another lot.");
  }
  if (!facts.latestDefault || facts.latestDefault.lotId !== facts.lot.id) {
    return refuse("offer_superseded", "The lot has no default this offer could answer.");
  }
  if (facts.latestDefault.id !== facts.offer.buyerDefaultId) {
    return refuse(
      "offer_superseded",
      "The lot defaulted again after this offer, so the offer no longer applies.",
    );
  }
  const source = facts.offer.sourceBid;
  if (
    !source ||
    source.lotId !== facts.lot.id ||
    source.bidderId !== facts.offer.offeredUserId ||
    source.legalEntityId !== facts.offer.offeredLegalEntityId ||
    source.amountPence !== facts.offer.amountPence
  ) {
    return refuse("offer_bid_mismatch", "The offer does not match the bid it was made from.");
  }
  if (facts.offer.status !== "accepted" || facts.offer.respondedAt === null) {
    return refuse("offer_not_accepted", "The lot is re-awarded only once a bidder has accepted.");
  }
  if (!canTransition(facts.lot.status, "reaward")) {
    return refuse("lot_not_reawardable", "The lot is no longer waiting for a buyer.");
  }
  if (facts.lot.winnerId !== null) {
    return refuse(
      "lot_has_buyer",
      "The lot has a buyer again, so it cannot be awarded to another.",
    );
  }
  const block = reawardBlock({ payments: facts.payments, otherOffers: facts.otherOffers });
  return block ? { ok: false, code: block.code, message: block.message } : { ok: true };
}
