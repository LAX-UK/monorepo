import { OIDC_ACR_BRONZE, OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import { buildAccountLinks, buildStaffPlatformLinks } from "./account-links";
import { buildAccountOverview } from "./account-overview.vm";
import { signInNotice } from "./sign-in-notice.vm";

describe("buildAccountOverview", () => {
  it("maps verified profile claims and silver ACR", () => {
    expect(
      buildAccountOverview(
        {
          name: " Ada Lovelace ",
          email: "ada@example.com",
          email_verified: true,
          phone_number: "+201000000000",
          phone_number_verified: true,
          acr: OIDC_ACR_SILVER,
        },
        OIDC_ACR_BRONZE,
      ),
    ).toEqual({
      displayName: "Ada Lovelace",
      name: "Ada Lovelace",
      email: "ada@example.com",
      emailVerified: true,
      phone: "+201000000000",
      phoneVerified: true,
      signedInWithAuthenticator: true,
      staffPlatforms: [],
    });
  });

  it("does not treat bronze or look-alike ACR strings as an authenticator sign-in", () => {
    expect(buildAccountOverview({}, OIDC_ACR_BRONZE).signedInWithAuthenticator).toBe(false);
    expect(buildAccountOverview({ acr: "silver" }, OIDC_ACR_SILVER).signedInWithAuthenticator).toBe(
      false,
    );
  });

  it("falls back to the session ACR and a neutral display name", () => {
    const vm = buildAccountOverview({ phone_number_verified: true }, OIDC_ACR_SILVER);
    expect(vm.signedInWithAuthenticator).toBe(true);
    expect(vm.displayName).toBe("Your LAX Account");
    expect(vm.phoneVerified).toBe(false);
  });
});

describe("buildAccountLinks", () => {
  it("points security actions at the hosted issuer pages for the account client", () => {
    const links = buildAccountLinks({
      oidcIssuer: "https://test-auth.lax.bid",
      oidcClientId: "lax-account-web",
      bidPublicUrl: "https://test.lax.bid",
    });
    expect(links).toEqual({
      manageTwoStep: "https://test-auth.lax.bid/two-factor/manage?client_id=lax-account-web",
      changePassword: "https://test-auth.lax.bid/forgot-password?client_id=lax-account-web",
      verifyEmail: "https://test-auth.lax.bid/resend-verification?client_id=lax-account-web",
      bidSettings: {
        profile: "https://test.lax.bid/dashboard/settings/profile",
        email: "https://test.lax.bid/dashboard/settings/account",
        addresses: "https://test.lax.bid/dashboard/settings/addresses",
        notifications: "https://test.lax.bid/dashboard/settings/notifications",
        deleteAccount: "https://test.lax.bid/dashboard/settings/security",
      },
      support: {
        helpCentre: "https://test.lax.bid/faq",
        contact: "https://test.lax.bid/contact",
        terms: "https://test.lax.bid/terms",
        privacyPolicy: "https://test.lax.bid/privacy",
      },
    });
  });

  it("prefills the account email on the hosted resend-verification page", () => {
    const url = new URL(
      buildAccountLinks(
        { oidcIssuer: "https://test-auth.lax.bid", oidcClientId: "lax-account-web" },
        { email: "collector@example.com" },
      ).verifyEmail,
    );
    expect(url.pathname).toBe("/resend-verification");
    expect(url.searchParams.get("email")).toBe("collector@example.com");
  });

  it("omits Bid-hosted settings and support links when Bid is not configured", () => {
    const links = buildAccountLinks({
      oidcIssuer: "http://localhost:3002",
      oidcClientId: "lax-account-web",
    });
    expect(links.bidSettings).toBeNull();
    expect(links.support).toBeNull();
  });
});

describe("signInNotice", () => {
  it("returns nothing without a reason", () => {
    expect(signInNotice(null)).toBeNull();
    expect(signInNotice("  ")).toBeNull();
  });

  it("maps known reasons and falls back to a generic error", () => {
    expect(signInNotice("access_denied")?.title).toBe("Sign-in cancelled");
    expect(signInNotice("mfa_required")?.tone).toBe("error");
    expect(signInNotice("invalid_state")?.title).toBe("We couldn't sign you in");
  });
});

describe("staff platforms", () => {
  it("reads platforms from the ID token and ignores malformed values", () => {
    expect(
      buildAccountOverview({ lax_staff_platforms: ["bid", "shop"] }, OIDC_ACR_BRONZE)
        .staffPlatforms,
    ).toEqual(["bid", "shop"]);
    expect(
      buildAccountOverview({ lax_staff_platforms: ["admin"] }, OIDC_ACR_BRONZE).staffPlatforms,
    ).toEqual([]);
    expect(
      buildAccountOverview({ lax_staff_platforms: "bid" }, OIDC_ACR_BRONZE).staffPlatforms,
    ).toEqual([]);
  });

  it("links each platform to its admin and skips platforms without a configured URL", () => {
    expect(
      buildStaffPlatformLinks({ bidPublicUrl: "https://lax.bid", shopAdminUrl: undefined }, [
        "bid",
        "shop",
      ]),
    ).toEqual([{ product: "bid", label: "LAX Bid admin", href: "https://lax.bid/admin" }]);
  });
});
