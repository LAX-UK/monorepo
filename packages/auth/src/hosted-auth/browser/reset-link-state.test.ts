import { describe, expect, it } from "vitest";
import { HOSTED_AUTH_MESSAGES } from "./messages.js";
import { resetLinkState } from "./reset-link-state.js";

const TOKEN = "reset-link-fixture";

describe("resetLinkState", () => {
  it("lets the person choose a password when the link carries a token", () => {
    expect(resetLinkState(new URLSearchParams({ token: TOKEN }))).toBe("ready");
  });

  it("reports a link with no token as incomplete", () => {
    expect(resetLinkState(new URLSearchParams(""))).toBe("missing");
    expect(resetLinkState(new URLSearchParams({ client_id: "lax-shop-web" }))).toBe("missing");
  });

  it("reports the redirect Better Auth sends for an expired or used link as invalid", () => {
    expect(resetLinkState(new URLSearchParams({ error: "INVALID_TOKEN" }))).toBe("invalid");
  });

  it("treats any error as invalid even when a token is still present", () => {
    expect(resetLinkState(new URLSearchParams({ error: "INVALID_TOKEN", token: TOKEN }))).toBe(
      "invalid",
    );
  });

  it("has a distinct message for each failing state", () => {
    expect(HOSTED_AUTH_MESSAGES.RESET_LINK_MISSING).not.toBe(HOSTED_AUTH_MESSAGES.RESET_INVALID);
  });
});
