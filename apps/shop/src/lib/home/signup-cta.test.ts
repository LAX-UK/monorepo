import { describe, expect, it } from "vitest";
import { homeSignupCta } from "./signup-cta.js";

describe("homeSignupCta", () => {
  it("uses register CTA for guests", () => {
    expect(
      homeSignupCta({
        kind: "guest",
        loginHref: "/login",
        registerHref: "/register",
      }),
    ).toEqual({ label: "Sign Up", href: "/register" });
  });

  it("uses account CTA for authenticated viewers", () => {
    expect(
      homeSignupCta({
        kind: "authenticated",
        displayName: "Alex",
        email: "a@example.com",
        accountHref: "/account",
        logoutHref: "/logout",
      }),
    ).toEqual({ label: "My account", href: "/account" });
  });

  it("uses account status when identity is disabled with a href", () => {
    expect(
      homeSignupCta({
        kind: "disabled",
        message: "Disabled",
        accountHref: "/account/disabled",
      }),
    ).toEqual({ label: "Account status", href: "/account/disabled" });
  });

  it("omits CTA when identity is disabled without a href", () => {
    expect(
      homeSignupCta({
        kind: "disabled",
        message: "Disabled",
      }),
    ).toBeNull();
  });

  it("omits CTA when session lookup is unavailable", () => {
    expect(
      homeSignupCta({
        kind: "unavailable",
        message: "Try again",
      }),
    ).toBeNull();
  });
});
