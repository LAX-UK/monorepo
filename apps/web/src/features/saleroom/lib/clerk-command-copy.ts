/** What the clerk console and door check-in say when a command does not go through. */
export const CLERK_COMMAND_COPY = {
  unreachable: "The saleroom could not be reached. Check the connection, then try again.",
  sessionExpired: "Your session has ended. Sign in again to continue.",
  /** Shown while the console re-reads the room after a command that did not answer cleanly. */
  outcomeUnknown: "Outcome unknown, checking the room…",
  lotNotOnBlock: "This lot is no longer on the block",
} as const;

const RAISE_THROUGH_OWNERS =
  "Take a bid within the limit. Only the organisation's owners or admins can raise it.";

/**
 * What the clerk is told when a limit refused a paddle or telephone bid, by the limit that did.
 * Money arrives already formatted. A limit shared across lots (the organisation's own limit, or a
 * buyer agent's total authorisation) is never shown, only the room it leaves on this lot.
 */
export const CLERK_BID_REFUSAL_COPY = {
  title: (bidder: string, amount: string) => `${bidder}'s bid of ${amount} wasn't placed`,
  /** The telephone bidder, when the booking has no name. */
  unnamedTelephoneBidder: "The telephone bidder",
  room: (available: string) => `They can bid up to ${available} on this lot.`,
  noRoom: "There's no room left for them to bid on this lot.",
  reason: {
    paddle: (limit: string) => `The paddle's limit for this sale is ${limit}.`,
    telephone: (limit: string) => `The telephone booking allows bids up to ${limit}.`,
    registration: (limit: string) => `Their approved limit for this sale is ${limit}.`,
    per_lot: (limit: string) => `Their buyer agent authorisation allows up to ${limit} a lot.`,
    authorisation_total: "It's above what their buyer agent authorisation allows in total.",
    organisation: "It's above what their organisation's bidding limit allows.",
  },
  next: {
    paddle:
      "Take a bid within the limit. To bid higher, the bidder's limit for this sale must be raised first.",
    telephone:
      "Take a bid within the limit. To bid higher, the booking's maximum must be raised first.",
    registration:
      "Take a bid within the limit. To bid higher, their registration limit must be raised first.",
    per_lot: RAISE_THROUGH_OWNERS,
    authorisation_total: RAISE_THROUGH_OWNERS,
    organisation: RAISE_THROUGH_OWNERS,
  },
} as const;
