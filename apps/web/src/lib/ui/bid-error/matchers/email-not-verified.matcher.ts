import type { BidErrorMatcher } from "../types";

export const emailNotVerifiedBidErrorMatcher: BidErrorMatcher = {
  match(raw) {
    if (raw !== "email_not_verified" && !raw.includes("email_not_verified")) return null;
    return {
      title: "Email verification required",
      message: "Verify your email address before bidding.",
      severity: "error",
      actionKey: "resend-verification-email",
      actionLabel: "Send verification email",
    };
  },
};
