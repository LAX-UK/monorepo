import { describe, expect, it } from "vitest";
import { buildVerifyEmailCallbackUrl } from "../lib/verify-email-callback-url.js";

describe("buildVerifyEmailCallbackUrl", () => {
  it("builds verify-email callback with email and persona", () => {
    expect(
      buildVerifyEmailCallbackUrl("https://lax.bid/", {
        email: "ada@example.com",
        persona: "individual",
      }),
    ).toBe("https://lax.bid/verify-email?email=ada%40example.com&persona=individual");
  });

  it("includes invite token when provided", () => {
    expect(
      buildVerifyEmailCallbackUrl("https://web.test", {
        email: "bob+tag@example.com",
        inviteToken: "invite-123",
      }),
    ).toBe("https://web.test/verify-email?email=bob%2Btag%40example.com&invite=invite-123");
  });
});
