import type { NextBidderNoneReason } from "@auction/validators";

/** Why nobody can be offered the lot, in one sentence for staff. One entry per reason. */
export const NO_NEXT_BIDDER_COPY: Record<NextBidderNoneReason, string> = {
  no_buyer: "This lot has no buyer on record.",
  no_other_bidder: "No one else bid on this lot.",
  no_eligible_bidder: "Every other bidder's account is suspended, closed or being deleted.",
  offer_limit_reached: "Three offers have been made. Return the lot to inventory.",
};

/** The page-level refusals a re-offer step can answer with, as the dialogs read them. */
export const CONFLICT_COPY =
  "That did not go through. Someone else changed this re-offer. Reload to see where it is.";
