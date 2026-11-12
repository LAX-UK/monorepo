import { OFFER_STATES, type OfferState } from "./offer-state.js";
import {
  WITHDRAWN_DISPLAY_DAYS,
  type WhereItIsInput,
  type WhereItIsKey,
  deriveWhereItIs,
} from "./where-it-is.js";

/** The Zoho Products Status picklist values LAX knows. Zoho staff may set others. */
export const ZOHO_STATUS = {
  available: "Available",
  reserved: "Reserved",
  inAuction: "In Auction",
  sold: "Sold",
  withdrawn: "Withdrawn",
} as const;

/**
 * Where each place an artwork is shown reads in the Zoho Products Status picklist. It maps the
 * "Where it is" place, not the raw register state, so a withdrawn artwork reads Withdrawn only for
 * the 30 days that place shows it and is Available again after that. LAX writes the Status to Zoho
 * and the sync health report compares it with what Zoho holds, so both read this one table.
 */
export const ZOHO_STATUS_FOR_PLACE: Readonly<Record<WhereItIsKey, string>> = {
  not_offered: ZOHO_STATUS.available,
  draft_lax_art: ZOHO_STATUS.available,
  lax_art: ZOHO_STATUS.available,
  draft_bid_lot: ZOHO_STATUS.available,
  bid_sale: ZOHO_STATUS.inAuction,
  private_sale: ZOHO_STATUS.reserved,
  withdrawn: ZOHO_STATUS.withdrawn,
  sold: ZOHO_STATUS.sold,
};

export function zohoStatusForPlace(place: WhereItIsKey): string {
  return ZOHO_STATUS_FOR_PLACE[place];
}

/** The Status LAX wants for an artwork: the place it is shown at, at this time. */
export function zohoStatusFor(input: WhereItIsInput): string {
  return zohoStatusForPlace(deriveWhereItIs(input).key);
}

/**
 * The Status of each register state, for readers that cannot call `zohoStatusFor` per row (a
 * database query). `withdrawnShows` says whether the 30-day Withdrawn display still applies: it is
 * the only thing the place depends on besides the state. Built from `zohoStatusFor`, so it cannot
 * drift from the writer.
 */
export function zohoStatusByOfferState(withdrawnShows: boolean): Record<OfferState, string> {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = new Date(0);
  const daysAgo = withdrawnShows ? 0 : WITHDRAWN_DISPLAY_DAYS + 1;
  const withdrawn = { at: new Date(now.getTime() - daysAgo * dayMs), from: null };
  const byState = {} as Record<OfferState, string>;
  for (const state of OFFER_STATES) {
    byState[state] = zohoStatusFor({ offer: { state, ref: null }, now, withdrawn });
  }
  return byState;
}

/**
 * Zoho OAuth token refreshes that fail in a row before the connection counts as failing: the
 * worker logs its alert on this one and LAX Admin's Sync health tab shows its notice.
 */
export const ZOHO_TOKEN_FAILING_STREAK = 2;
