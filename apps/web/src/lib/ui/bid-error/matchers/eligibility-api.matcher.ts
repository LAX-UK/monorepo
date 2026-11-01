import type { BidErrorMatcher, BidErrorPresentation, MapBidErrorOptions } from "../types";

function matchesCode(options: MapBidErrorOptions | undefined, code: string, raw: string): boolean {
  if (options?.code === code) return true;
  return raw === code || raw.includes(code);
}

/** The place-bid API names a refusal by its typed code; the older raised code still matches. */
function matchesAnyCode(
  options: MapBidErrorOptions | undefined,
  codes: readonly string[],
  raw: string,
): boolean {
  return codes.some((code) => matchesCode(options, code, raw));
}

export const saleRegistrationRequiredBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    if (!matchesAnyCode(options, ["registration_required", "sale_registration_required"], raw))
      return null;
    return {
      title: "Registration required",
      message: "Register and be approved to bid on this sale before placing a bid.",
      severity: "error",
      ...(options?.saleRegistrationPath
        ? {
            actionHref: options.saleRegistrationPath,
            actionLabel: "Register for this sale",
          }
        : {}),
    };
  },
};

export const bidLimitExceededBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    if (!matchesAnyCode(options, ["over_limit", "bid_limit_exceeded"], raw)) return null;
    const agentLimit = raw.includes("buyer agent authorisation");
    return {
      title: "Bid limit exceeded",
      message: agentLimit
        ? "This bid exceeds your buyer agent authorisation limit for this sale."
        : "This bid exceeds your approved limit for this sale.",
      severity: "error",
      ...(options?.saleRegistrationPath
        ? {
            actionHref: options.saleRegistrationPath,
            actionLabel: "View sale registration",
          }
        : {}),
    };
  },
};

export const membershipRequiredBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    if (!matchesCode(options, "membership_required", raw)) return null;
    return {
      title: "Organisation membership required",
      message: "You must be a member of the buying organisation to place this bid.",
      severity: "error",
      actionHref: "/organisations",
      actionLabel: "View organisations",
    };
  },
};

export const notAMemberOfLegalEntityBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    if (!matchesCode(options, "not_a_member_of_legal_entity", raw)) return null;
    return {
      title: "Bidding profile out of sync",
      message:
        "Your bid was sent for an organisation you're not a member of. We've reset you to your personal profile — please place the bid again.",
      severity: "warning",
    };
  },
};

export const buyerAgentAuthorisationBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    if (!matchesCode(options, "buyer_agent_authorisation_required", raw)) return null;
    return {
      title: "Authorisation needed",
      message:
        "An owner or admin of this organisation needs to authorise you for this sale before you can bid for it. You can still bid in your own name.",
      severity: "error",
    };
  },
};

export const bidRoleNotPermittedBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    if (!matchesCode(options, "bid_role_not_permitted", raw)) return null;
    return {
      title: "You can't bid for this organisation",
      message:
        "Only owners, admins and authorised buyers can bid for this organisation. You can still bid in your own name.",
      severity: "error",
    };
  },
};

export const entityNotAuthorisedBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    if (!matchesCode(options, "entity_not_authorised_to_bid", raw)) return null;
    return {
      title: "Account not authorised",
      message: "Your buying profile is not approved to place bids yet.",
      severity: "error",
      // The accounts list shows each account's approval status.
      actionHref: "/organisations",
      actionLabel: "View your accounts",
    };
  },
};

export const bidRateLimitedBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    const minute = matchesCode(options, "bid_rate_limited_minute", raw) || raw === "Too many bids";
    const hour = matchesCode(options, "bid_rate_limited_hour", raw);
    if (!minute && !hour) return null;
    return {
      title: "Slow down",
      message: hour
        ? "You have reached the hourly bid limit. Wait a while before bidding again."
        : "You are bidding too quickly. Wait a moment and try again.",
      severity: "warning",
    };
  },
};

export const biddingDisabledBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    if (
      !matchesCode(options, "bidding_disabled", raw) &&
      !raw.includes("Bidding temporarily disabled")
    )
      return null;
    return {
      title: "Bidding paused",
      message: "Bidding is temporarily disabled. Please try again shortly.",
      severity: "info",
    };
  },
};

export const bidInFlightBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    if (!matchesCode(options, "bid_in_flight", raw) && !raw.includes("Bid still processing"))
      return null;
    return {
      title: "Bid in progress",
      message: "Your previous bid is still being processed. Wait a moment, then try again.",
      severity: "warning",
    };
  },
};
