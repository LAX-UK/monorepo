import { describe, expect, it } from "vitest";
import { mapBidError } from "../index";

describe("emailNotVerifiedBidErrorMatcher", () => {
  it("prefers a structured stale-session API code and exposes resend", () => {
    expect(
      mapBidError("Forbidden", {
        code: "email_not_verified",
        verifyReturnPath: "/lot/example/lot-1",
      }),
    ).toMatchObject({
      title: "Email verification required",
      actionKey: "resend-verification-email",
      actionLabel: "Send verification email",
    });
  });
});
