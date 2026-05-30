import type { BidErrorMatcher, BidErrorPresentation, MapBidErrorOptions } from "../types";

export const alreadyLeadingBidErrorMatcher: BidErrorMatcher = {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null {
    const code = options?.code;
    if (
      code !== "already_leading" &&
      raw !== "already_leading" &&
      !raw.includes("already the highest")
    ) {
      return null;
    }
    return {
      title: "You are leading",
      message:
        "You are already the highest bidder. Raise your auto-bid max instead of bidding again.",
      severity: "info",
    };
  },
};
