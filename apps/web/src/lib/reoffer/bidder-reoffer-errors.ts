/**
 * What the bidder is told when their answer to an offer does not go through, by the API's code.
 * One table: a new refusal is a new row.
 */
type AnswerRefusal = {
  message: string;
  /** The offer is over or has changed: the page reloads to show where it stands. */
  settled: boolean;
  /** The offer ended while the person was answering, which the page says in its own notice. */
  ended?: boolean;
};

const NO_LONGER_AVAILABLE = "This lot is no longer available. Nothing has been charged.";

const REFUSALS: Readonly<Record<string, AnswerRefusal>> = {
  forbidden: { message: "Your role in this account can't answer this offer.", settled: false },
  offer_not_found: { message: "We couldn't find this offer.", settled: true },
  terms_not_accepted: { message: "Tick the box to accept.", settled: false },
  offer_window_ended: {
    message: "This offer has ended. It can no longer be accepted.",
    settled: true,
    ended: true,
  },
  offer_not_open: { message: "This offer is no longer open.", settled: true },
  offer_superseded: { message: "This offer is no longer open.", settled: true },
  bidder_unavailable: {
    message: "This account can no longer accept this offer. Contact us if you think this is wrong.",
    settled: false,
  },
  money_paused: {
    message: "Offers can't be accepted just now. Try again in a little while.",
    settled: false,
  },
  conflict: {
    message: "That did not go through. Something changed on this offer. Reload to see where it is.",
    settled: true,
  },
  sold_on_atg: { message: NO_LONGER_AVAILABLE, settled: true },
  lot_not_reawardable: { message: NO_LONGER_AVAILABLE, settled: true },
  lot_has_buyer: { message: NO_LONGER_AVAILABLE, settled: true },
  lot_not_ended: { message: NO_LONGER_AVAILABLE, settled: true },
  offer_bid_mismatch: { message: NO_LONGER_AVAILABLE, settled: true },
  artwork_offered_elsewhere: { message: NO_LONGER_AVAILABLE, settled: true },
  consent_not_given: { message: NO_LONGER_AVAILABLE, settled: true },
};

export const REOFFER_UNAVAILABLE =
  "Something went wrong on our side. Nothing was changed. Try again in a moment.";

/** The words for a refusal; an unknown code says it is on our side and that nothing changed. */
export function bidderReofferErrorMessage(code: string | undefined): string {
  return (code ? REFUSALS[code]?.message : undefined) ?? REOFFER_UNAVAILABLE;
}

/** After these the offer is over or changed, so the page reloads instead of asking again. */
export function bidderReofferIsSettled(code: string | undefined): boolean {
  return code !== undefined && REFUSALS[code]?.settled === true;
}

/** The offer ended while the person was answering. */
export function bidderReofferEndedWhileAnswering(code: string | undefined): boolean {
  return code !== undefined && REFUSALS[code]?.ended === true;
}
