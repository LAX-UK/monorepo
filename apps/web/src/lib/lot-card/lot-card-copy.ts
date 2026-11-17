/**
 * The words a lot card says. Every lot grid (sale page, search) reads them from here, so a card
 * says the same thing wherever the lot appears.
 */
export const LOT_CARD_COPY = {
  /** The card's full-width button while the lot is open for bids. */
  bid: "Bid",
  /** Before the sale opens, for a viewer who still has to register. */
  registerToBid: "Register to bid",
  /** Before the lot opens, for a registered viewer, where the sale takes bids in advance. */
  leaveABid: "Leave a bid",
  /** The quiet label that opens quick look, shown on hover or keyboard focus (desktop only). */
  quickLook: "Quick look",
  quickLookAt: (title: string) => `Quick look at ${title}`,
} as const;
