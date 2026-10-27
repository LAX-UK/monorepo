import type { LegalEntityMemberRole } from "@auction/types";
import { minPositiveCap } from "./bid-cap.js";
import { entityRoleCan } from "./entity-capabilities.js";

/**
 * An active buyer-agent authorisation that covers the moment of the bid: either every sale
 * (`saleId: null`) or one sale. The caller has already dropped revoked, future and expired rows.
 */
export type BuyerAgentGrant = {
  saleId: string | null;
  /** Highest bid allowed, in major units; `null` means no limit. */
  bidLimit: number | null;
};

/** Why a person may not bid for a legal entity. */
export type BidAuthorityDenial =
  /** Not an active member of the legal entity. */
  | "not_member"
  /** A member whose role does not bid for the organisation (finance, consignor, viewer). */
  | "role_cannot_bid"
  /** A buyer agent with no active authorisation for this sale. */
  | "authorisation_required";

export type BidAuthorityDecision =
  | {
      allowed: true;
      role: LegalEntityMemberRole;
      /** True when the bid rests on a buyer-agent authorisation. */
      viaAuthorisation: boolean;
      /** The authorisation's limit in major units, or `null` when there is none. */
      bidLimit: number | null;
    }
  | { allowed: false; role: LegalEntityMemberRole | null; reason: BidAuthorityDenial };

/** Error codes the bidding channels return for each denial; clients map these to copy. */
export const BID_AUTHORITY_ERROR_CODES: Record<BidAuthorityDenial, string> = {
  not_member: "membership_required",
  role_cannot_bid: "bid_role_not_permitted",
  authorisation_required: "buyer_agent_authorisation_required",
};

/** Whether a role may bid for the organisation only through an authorisation. */
export function roleBidsThroughAuthorisation(role: LegalEntityMemberRole): boolean {
  return (
    entityRoleCan(role, "entity.bid.place") &&
    !entityRoleCan(role, "entity.bid.place_without_authorisation")
  );
}

/**
 * The limit that applies to a bid: a sale-specific authorisation wins over an all-sales one,
 * and within the winning scope the lowest limit applies.
 */
function effectiveLimit(grants: readonly BuyerAgentGrant[], saleId: string | null): number | null {
  const saleScoped = saleId ? grants.filter((g) => g.saleId === saleId) : [];
  const scoped = saleScoped.length > 0 ? saleScoped : grants;
  return scoped.reduce<number | null>((cap, g) => minPositiveCap(cap, g.bidLimit), null);
}

/**
 * Who may bid for a legal entity. The role decides through the capability table; a role that
 * bids through an authorisation also needs a grant that covers the sale.
 */
export function decideBidAuthority(input: {
  role: LegalEntityMemberRole | null;
  grants: readonly BuyerAgentGrant[];
  saleId: string | null;
}): BidAuthorityDecision {
  const { role, grants, saleId } = input;
  if (!role) return { allowed: false, role: null, reason: "not_member" };
  if (!entityRoleCan(role, "entity.bid.place")) {
    return { allowed: false, role, reason: "role_cannot_bid" };
  }
  if (!roleBidsThroughAuthorisation(role)) {
    return { allowed: true, role, viaAuthorisation: false, bidLimit: null };
  }
  const covering = grants.filter((g) => g.saleId === null || g.saleId === saleId);
  if (covering.length === 0) {
    return { allowed: false, role, reason: "authorisation_required" };
  }
  return {
    allowed: true,
    role,
    viaAuthorisation: true,
    bidLimit: effectiveLimit(covering, saleId),
  };
}

/** Whether `amount` is above the decision's limit. */
export function bidExceedsAuthority(decision: BidAuthorityDecision, amount: number): boolean {
  return decision.allowed && decision.bidLimit != null && amount > decision.bidLimit;
}
