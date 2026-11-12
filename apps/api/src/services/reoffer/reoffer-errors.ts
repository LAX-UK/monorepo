/** Every way a re-offer step can be refused, each with the status it answers with. */
const REOFFER_ERRORS = {
  // Who and what
  forbidden: 403,
  lot_not_found: 404,
  offer_not_found: 404,
  // Input
  note_required: 422,
  terms_not_accepted: 422,
  invalid_offer_days: 422,
  // Starting
  sold_on_atg: 409,
  buyer_default_not_recorded: 409,
  default_not_latest: 409,
  payment_in_progress: 409,
  already_re_offered: 409,
  open_offer_exists: 409,
  seller_declined_last_offer: 409,
  offer_limit_reached: 409,
  no_other_bidder: 422,
  no_eligible_bidder: 422,
  seller_terms_unavailable: 409,
  // The seller's answer
  consent_already_answered: 409,
  consent_not_requested: 409,
  consent_not_allowed: 409,
  consent_window_ended: 409,
  consent_not_given: 409,
  lapsed_request_closed: 409,
  // Sending and answering
  offer_not_ready: 409,
  offer_not_open: 409,
  offer_window_ended: 409,
  offer_superseded: 409,
  offer_bid_mismatch: 409,
  bidder_unavailable: 409,
  lot_not_reawardable: 409,
  lot_has_buyer: 409,
  lot_not_ended: 409,
  /** The total the bidder accepted is no longer what the lot would be invoiced at. */
  price_changed: 409,
  // Other products
  artwork_offered_elsewhere: 409,
  money_paused: 423,
  // Races
  conflict: 409,
} as const;

export type ReofferErrorCode = keyof typeof REOFFER_ERRORS;
export type ReofferErrorStatus = (typeof REOFFER_ERRORS)[ReofferErrorCode];

/** A refusal a person can act on: a stable code for the screen and words for the reader. */
export class ReofferError extends Error {
  readonly status: ReofferErrorStatus;
  constructor(
    readonly code: ReofferErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReofferError";
    this.status = REOFFER_ERRORS[code];
  }
}

export function isReofferErrorCode(code: string): code is ReofferErrorCode {
  return Object.hasOwn(REOFFER_ERRORS, code);
}
