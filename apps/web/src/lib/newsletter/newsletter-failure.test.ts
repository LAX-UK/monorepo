import { AUTH_ERROR_MESSAGES, authSubmitFailure } from "@/lib/auth/auth-error-code";
import { describe, expect, it } from "vitest";
import { NEWSLETTER_SUBMIT_FAILED_MESSAGE, newsletterSubmitFailure } from "./newsletter-failure";

describe("newsletterSubmitFailure", () => {
  it("is the same failure the auth error map gives for the newsletter", () => {
    expect(AUTH_ERROR_MESSAGES.newsletter_submit_failed).toBe(NEWSLETTER_SUBMIT_FAILED_MESSAGE);
    expect(newsletterSubmitFailure()).toEqual(authSubmitFailure("newsletter_submit_failed"));
  });
});
