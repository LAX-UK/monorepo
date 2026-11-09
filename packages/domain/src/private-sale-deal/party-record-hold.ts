import {
  type EnquiryDealRecord,
  addYears,
  isDealRecordRetained,
} from "../marketing-enquiry-erasure.js";
import { isDealClosed } from "./views.js";

/** A deal a person is, or was ever named as, a party to, with what is needed to say why it holds. */
export type PartyDealRecord = EnquiryDealRecord & {
  /** What staff quote (PS-0012). */
  reference: string;
  /** The last time the deal changed stage; `null` if that is not known. */
  lastChangeAt: Date | null;
};

/** Why one deal holds a person's evidence. */
export type PartyHoldReason = {
  reference: string;
  /**
   * `open`: the deal has not ended, so the hold runs until it does. `running`: it ended and the
   * retention period is running. `end_unknown`: it ended but when is not recorded, so the hold has
   * no end date and stays until someone settles it.
   */
  kind: "open" | "running" | "end_unknown";
  /** When the hold ends; `null` for an open deal or one whose end is not known. */
  heldUntil: Date | null;
  /** An open deal that has not changed stage for longer than the retention period. */
  stale: boolean;
};

export type PartyEvidenceHold = {
  held: boolean;
  reasons: PartyHoldReason[];
  /** When the last hold ends; `null` if any hold is open or has no end. */
  heldUntil: Date | null;
  /** A hold has no end date, so nothing will release it by itself. */
  withoutEnd: boolean;
  /** A deal has stood still for longer than the retention period. */
  stale: boolean;
};

/** Whether the deal still holds the person's evidence, and how, or `null` when it does not. */
function reasonFor(
  deal: PartyDealRecord,
  now: Date,
  retentionYears: number,
): PartyHoldReason | null {
  if (!isDealRecordRetained(deal, now, retentionYears)) return null;
  if (!isDealClosed(deal.stage)) {
    const stale = deal.lastChangeAt !== null && now > addYears(deal.lastChangeAt, retentionYears);
    return { reference: deal.reference, kind: "open", heldUntil: null, stale };
  }
  if (deal.endedAt === null) {
    return { reference: deal.reference, kind: "end_unknown", heldUntil: null, stale: false };
  }
  return {
    reference: deal.reference,
    kind: "running",
    heldUntil: addYears(deal.endedAt, retentionYears),
    stale: false,
  };
}

/**
 * Whether the KYC, AML and source-of-funds evidence of someone who is, or was ever named as, a
 * party to private sale deals must be kept because a deal's record is still retained, and why.
 *
 * The evidence for a person's own five years after their relationship ends (the KYC retention) and
 * the evidence for a deal's record for the private sale retention after the deal ends (the
 * Money Laundering Regulations 2017, regulation 40: five years after the transaction) are two
 * clocks. The evidence is deleted only when both have run out, so this rule is the second one: it
 * holds the evidence while any deal the person was named on is still retained, by the same rule
 * that holds the deal's enquiry from erasure. A deal still open, a deal with no known end, and a
 * deal that ended inside the period all hold it; a deal withdrawn before agreement with no check
 * opened for the person since the enquiry arrived holds nothing.
 *
 * Two holds need a person to look at them, because nothing will release them: one with no end
 * date, and an open deal that has not moved for longer than the retention period.
 */
export function partyEvidenceHold(
  deals: readonly PartyDealRecord[],
  now: Date,
  retentionYears: number,
): PartyEvidenceHold {
  const reasons = deals.flatMap((deal) => {
    const reason = reasonFor(deal, now, retentionYears);
    return reason ? [reason] : [];
  });
  const open = reasons.some((reason) => reason.kind !== "running");
  const ends = reasons.flatMap((reason) => (reason.heldUntil ? [reason.heldUntil] : []));
  return {
    held: reasons.length > 0,
    reasons,
    heldUntil:
      reasons.length === 0 || open ? null : new Date(Math.max(...ends.map((end) => end.getTime()))),
    withoutEnd: reasons.some((reason) => reason.kind === "end_unknown"),
    stale: reasons.some((reason) => reason.stale),
  };
}

/** Whether any deal still holds the person's evidence. */
export function kycEvidenceHeldForDeals(
  deals: readonly EnquiryDealRecord[],
  now: Date,
  retentionYears: number,
): boolean {
  return deals.some((deal) => isDealRecordRetained(deal, now, retentionYears));
}
