import { describe, expect, it } from "vitest";
import { emailVerificationBidBlockerPresentation } from "./email-verification-blocker.presenter";

describe("emailVerificationBidBlockerPresentation", () => {
  it("includes the email address in an email action", () => {
    const presentation = emailVerificationBidBlockerPresentation(
      "buyer@example.com",
      "/lot/example/lot-1",
    );
    expect(presentation.tone).toBe("warning");
    expect(presentation.title).toBe("Verify your email to bid");
    expect(presentation.detail).toEqual(expect.stringContaining("buyer@example.com"));
    expect(presentation.action).toEqual({
      kind: "email",
      email: "buyer@example.com",
      next: "/lot/example/lot-1",
      label: "Send verification email",
      shortLabel: "Verify email",
    });
    expect(presentation.preview).toBeDefined();
  });
});
