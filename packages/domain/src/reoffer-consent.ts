import type { ReofferEvent } from "./reoffer-state.js";

/** The seller's agreement to one offer, recorded with every answer. */
export const SELLER_CONSENT_STATUSES = [
  "requested",
  "given",
  "refused",
  "lapsed",
  "not_needed",
] as const;
export type SellerConsentStatus = (typeof SELLER_CONSENT_STATUSES)[number];

export const SELLER_CONSENT_ANSWERS = ["given", "refused", "lapsed"] as const;
export type SellerConsentAnswer = (typeof SELLER_CONSENT_ANSWERS)[number];

/** Whose stock the lot is: a seller's, or LAX's own. */
export type LotOwnership = "seller" | "lax_owned";

export type ConsentRequirement = {
  /** The consent the offer starts with: `requested` or `not_needed`. */
  status: "requested" | "not_needed";
  /** Staff-facing reason when no consent is asked, for the record. */
  reason: "seller_consent_required" | "lax_owned_no_consent_needed";
  /** A reserve was agreed. */
  hasReserve: boolean;
  /** The offer is below the agreed reserve (carried for the seller's page and staff). */
  belowReserve: boolean;
};

/**
 * Whether the seller must agree to this offer. Always, for every offer, except stock LAX owns.
 * The reserve never changes the answer; it is carried so the seller and staff see it.
 */
export function consentRequirement(input: {
  ownership: LotOwnership;
  offerMinor: number;
  reserveMinor: number | null;
}): ConsentRequirement {
  const hasReserve = input.reserveMinor !== null && input.reserveMinor > 0;
  const belowReserve = hasReserve && input.offerMinor < (input.reserveMinor as number);
  const laxOwned = input.ownership === "lax_owned";
  return {
    status: laxOwned ? "not_needed" : "requested",
    reason: laxOwned ? "lax_owned_no_consent_needed" : "seller_consent_required",
    hasReserve,
    belowReserve,
  };
}

/** The status an offer starts in: ready to send when no consent is needed, else waiting. */
export function initialReofferStatus(consent: ConsentRequirement): "awaiting_seller" | "ready" {
  return consent.status === "not_needed" ? "ready" : "awaiting_seller";
}

export type ConsentTransition =
  | { ok: true; status: SellerConsentStatus; reofferEvent: ReofferEvent }
  | { ok: false; reason: "already_answered" | "not_requested" };

const ANSWER_EVENT: Record<SellerConsentAnswer, ReofferEvent> = {
  given: "seller_agreed",
  refused: "seller_declined",
  lapsed: "seller_lapsed",
};

/**
 * Records the seller's answer (or the lapse of the window). Only a requested consent can be
 * answered, once; a missing answer is never taken as a yes. The result names the offer event
 * that follows.
 */
export function answerConsent(
  status: SellerConsentStatus,
  answer: SellerConsentAnswer,
): ConsentTransition {
  if (status === "not_needed") return { ok: false, reason: "not_requested" };
  if (status !== "requested") return { ok: false, reason: "already_answered" };
  return { ok: true, status: answer, reofferEvent: ANSWER_EVENT[answer] };
}
