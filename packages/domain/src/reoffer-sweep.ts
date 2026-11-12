import type { ReofferStatus } from "./reoffer-state.js";
import { sellerConsentWindow } from "./reoffer-windows.js";

/**
 * What the clock does with an open offer or seller request. Pure: the worker reads the facts
 * under the lot's lock, asks here, and writes only what the answer says. A request or offer that
 * has moved on since it was listed is `none`, so a stale listing never acts.
 */

/** The bidder is reminded this long before the offer ends. */
export const OFFER_REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;

export type SellerRequestFacts = {
  offerStatus: ReofferStatus;
  consentStatus: string;
  requestedAt: Date;
  dueAt: Date | null;
  remindedAt: Date | null;
};

export type SellerRequestStep = "lapse" | "remind" | "none";

/**
 * A request still waiting lapses at its deadline: silence is never a yes. Before that the seller
 * is reminded once, from the reminder time. A request with no deadline is never touched.
 */
export function sellerRequestStep(facts: SellerRequestFacts, now: Date): SellerRequestStep {
  if (facts.offerStatus !== "awaiting_seller" || facts.consentStatus !== "requested") return "none";
  if (facts.dueAt === null) return "none";
  if (now.getTime() >= facts.dueAt.getTime()) return "lapse";
  if (facts.remindedAt !== null) return "none";
  const { reminderAt } = sellerConsentWindow(facts.requestedAt);
  return now.getTime() >= reminderAt.getTime() ? "remind" : "none";
}

export type OfferFacts = {
  status: ReofferStatus;
  offerSentAt: Date | null;
  offerEndsAt: Date | null;
};

export type OfferStep = "end" | "remind" | "none";

/** When the bidder is reminded, or `null` when the offer was too short to have a reminder. */
export function offerReminderAt(
  offer: Pick<OfferFacts, "offerSentAt" | "offerEndsAt">,
): Date | null {
  if (offer.offerSentAt === null || offer.offerEndsAt === null) return null;
  const at = new Date(offer.offerEndsAt.getTime() - OFFER_REMINDER_LEAD_MS);
  return at.getTime() > offer.offerSentAt.getTime() ? at : null;
}

/**
 * An offer that is out ends at its end time, whatever the bidder did not do; before that it is
 * reminded once, a day ahead. The end is a closed window: at the end time itself the bidder can
 * no longer answer (`reofferResponseBlock`), so the clock may close it.
 */
export function offerStep(offer: OfferFacts, now: Date): OfferStep {
  if (offer.status !== "offered" || offer.offerEndsAt === null) return "none";
  if (now.getTime() >= offer.offerEndsAt.getTime()) return "end";
  const reminderAt = offerReminderAt(offer);
  return reminderAt !== null && now.getTime() >= reminderAt.getTime() ? "remind" : "none";
}
