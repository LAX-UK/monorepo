import { describe, expect, it } from "vitest";
import { connectApiErrorMessage, connectErrorMessage } from "./connect-error-copy";

describe("connectApiErrorMessage", () => {
  it("maps platform profile incomplete to seller-facing copy", () => {
    expect(connectApiErrorMessage("stripe_platform_profile_incomplete")).toContain(
      "temporarily unavailable",
    );
  });

  it("maps finance awaiting owner copy", () => {
    expect(connectApiErrorMessage("finance_awaiting_owner")).toContain("owner or admin");
  });

  it("maps stripe_connect_failed fallback copy", () => {
    expect(connectApiErrorMessage("stripe_connect_failed")).toContain(
      "could not start payout setup",
    );
  });

  it("maps dashboard_link_not_supported for embedded-only policy", () => {
    expect(connectApiErrorMessage("dashboard_link_not_supported")).toContain("secure form");
  });

  it("returns null for unknown codes", () => {
    expect(connectApiErrorMessage("unknown_code")).toBeNull();
  });
});

describe("connectErrorMessage", () => {
  it("uses API code mapping for init_failed", () => {
    expect(connectErrorMessage("init_failed", "stripe_platform_profile_incomplete")).toContain(
      "temporarily unavailable",
    );
  });
});
