import { BID_AUTHORITY_ERROR_CODES, type BidAuthorityDenial } from "@auction/domain";
import { BidError } from "../bid-error.js";

const MESSAGES: Record<BidAuthorityDenial, string> = {
  not_member: "Not a member of this legal entity",
  role_cannot_bid: "Only owners, admins and authorised buyers can bid for this organisation",
  authorisation_required: "Buyer agent authorisation is required for this legal entity",
};

/** The error every bidding channel returns when the bid authority says no. */
export function bidAuthorityError(reason: BidAuthorityDenial): BidError {
  return new BidError(MESSAGES[reason], 403, BID_AUTHORITY_ERROR_CODES[reason]);
}
