/** The fixed rules of a re-offer after a buyer default, in one place. */

/** Offers made for one default, one after another, before the lot goes back to inventory. */
export const MAX_REOFFERS_PER_DEFAULT = 3;

/** Working days the seller has to answer. */
export const SELLER_CONSENT_WORKING_DAYS = 3;

/** The seller is reminded once, this many working days after being asked. */
export const SELLER_CONSENT_REMINDER_WORKING_DAYS = 2;

/** Days a bidder has to accept an offer, unless staff choose another length. */
export const DEFAULT_OFFER_DAYS = 3;
export const MIN_OFFER_DAYS = 1;
export const MAX_OFFER_DAYS = 7;

/** Every deadline (the seller's answer, the end of an offer) falls at this London time. */
export const DEADLINE_AT_LOCAL = "17:00";
