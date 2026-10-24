import { describe, expect, it } from "vitest";
import {
  OidcClientKind,
  REGISTERED_OIDC_CLIENTS,
  REGISTERED_OIDC_CLIENT_IDS,
  oidcClientIdsWithImplicitConsent,
} from "./clients.js";

describe("registered OIDC clients", () => {
  it("keeps each confidential web client least-privileged", () => {
    const bid = REGISTERED_OIDC_CLIENTS[REGISTERED_OIDC_CLIENT_IDS.LAX_BID_WEB];
    expect(bid.kind).toBe(OidcClientKind.Confidential);
    expect(bid.allowedResources).toEqual(["lax-bid-api", "lax-ws"]);
    expect(bid.allowedScopes).toEqual([
      "openid",
      "profile",
      "email",
      "offline_access",
      "bid.read",
      "bid.write",
    ]);
    expect(bid.allowedScopes).not.toContain("shop.read");
    expect(bid.backchannelLogoutUri).toBe("https://lax.bid/api/auth/backchannel-logout");
    expect(bid.testBackchannelLogoutUri).toBe("https://test.lax.bid/api/auth/backchannel-logout");
    expect(bid.backchannelLogoutSessionRequired).toBe(true);
    expect(bid.postLogoutRedirectUris).toContain("https://lax.bid/");
    expect(bid.consentPolicy).toBe("implicit");

    const shop = REGISTERED_OIDC_CLIENTS[REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB];
    expect(shop.kind).toBe(OidcClientKind.Confidential);
    expect(shop.redirectUris).toContain("https://shop.lax.art/auth/callback");
    expect(shop.allowedResources).toEqual(["lax-shop-api"]);
    expect(shop.allowedScopes).toEqual([
      "openid",
      "profile",
      "email",
      "offline_access",
      "phone",
      "shop.read",
      "shop.write",
    ]);
    expect(shop.allowedScopes).not.toContain("bid.read");
    expect(shop.backchannelLogoutUri).toBe("https://shop.lax.art/api/auth/backchannel-logout");
    expect(shop.backchannelLogoutSessionRequired).toBe(true);
    expect(shop.postLogoutRedirectUris).toEqual([
      "http://localhost:3010/",
      "http://localhost:3020/",
      "http://localhost:3020/signed-out",
      "https://shop.lax.art/",
      "https://shop.lax.art/signed-out",
      "https://test-shop.lax.bid/",
      "https://test-shop.lax.bid/signed-out",
    ]);
    expect(shop.testBackchannelLogoutUri).toBe(
      "https://test-shop.lax.bid/api/auth/backchannel-logout",
    );
    expect(shop.consentPolicy).toBe("implicit");
  });

  it("lets the Art storefront return to its signed-out page after logout", () => {
    const art = REGISTERED_OIDC_CLIENTS[REGISTERED_OIDC_CLIENT_IDS.LAX_ART_WEB];
    expect(art.postLogoutRedirectUris).toEqual([
      "http://localhost:3050/",
      "http://localhost:3050/signed-out",
      "https://www.thelax.art/",
      "https://www.thelax.art/signed-out",
      "https://test-art.lax.bid/",
      "https://test-art.lax.bid/signed-out",
    ]);
  });

  it("registers shop admin client for staff API and acceptance only", () => {
    const admin = REGISTERED_OIDC_CLIENTS[REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_ADMIN];
    expect(admin.kind).toBe(OidcClientKind.Confidential);
    expect(admin.allowedResources).toEqual(["lax-shop-api", "lax-bid-api"]);
    expect(admin.allowedScopes).toContain("shop.admin");
    expect(admin.redirectUris).toContain("https://test-shop-admin.lax.bid/api/auth/callback");
    expect(admin.redirectUris).not.toContain("https://test-shop.lax.bid/");
    expect(admin.backchannelLogoutUri).toBe(
      "https://admin.shop.lax.art/api/auth/backchannel-logout",
    );
  });

  it("registers the Art storefront for the commerce API only, with its own hosts", () => {
    const art = REGISTERED_OIDC_CLIENTS[REGISTERED_OIDC_CLIENT_IDS.LAX_ART_WEB];
    expect(art.kind).toBe(OidcClientKind.Confidential);
    expect(art.allowedResources).toEqual(["lax-shop-api"]);
    expect(art.allowedScopes).not.toContain("shop.admin");
    expect(art.redirectUris).toEqual([
      "http://localhost:3051/auth/callback",
      "https://www.thelax.art/auth/callback",
      "https://test-art.lax.bid/auth/callback",
    ]);
    expect(art.testBackchannelLogoutUri).toBe(
      "https://test-art.lax.bid/api/auth/backchannel-logout",
    );
  });

  it("limits LAX Account to the read-only portfolio scope on Bid and Shop", () => {
    const account = REGISTERED_OIDC_CLIENTS[REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB];
    expect(account.allowedResources).toEqual(["lax-bid-api", "lax-shop-api"]);
    expect(account.allowedScopes.filter((scope) => scope.includes("."))).toEqual([
      "lax.portfolio.read",
    ]);
  });

  it("lets LAX Admin exchange for Shop and, read-only, for Bid's staff tools", () => {
    const admin = REGISTERED_OIDC_CLIENTS[REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_ADMIN];
    expect(admin.allowedResources).toEqual(["lax-shop-api", "lax-bid-api"]);
    expect(admin.allowedScopes.filter((scope) => scope.includes("."))).toEqual([
      "shop.admin",
      "lax.staff.tools.read",
    ]);
  });

  it("pre-authorizes Bid, Shop web, lax.art, and Shop admin clients", () => {
    expect([...oidcClientIdsWithImplicitConsent()].sort()).toEqual(
      ["lax-account-web", "lax-art-web", "lax-bid-web", "lax-shop-admin", "lax-shop-web"].sort(),
    );
    expect(REGISTERED_OIDC_CLIENTS[REGISTERED_OIDC_CLIENT_IDS.WS_MOBILE].consentPolicy).toBe(
      "explicit",
    );
  });

  it("does not retain the proof client or grant Shop access to ws-mobile", () => {
    expect(REGISTERED_OIDC_CLIENTS).not.toHaveProperty("retired-shop-client");
    const mobile = REGISTERED_OIDC_CLIENTS[REGISTERED_OIDC_CLIENT_IDS.WS_MOBILE];
    expect(mobile.kind).toBe(OidcClientKind.Public);
    expect(mobile.allowedResources).toEqual(["lax-ws"]);
    expect(mobile.allowedScopes.some((scope) => scope.startsWith("shop."))).toBe(false);
    expect(mobile.backchannelLogoutUri).toBeUndefined();
    expect(mobile.backchannelLogoutSessionRequired).toBeUndefined();
    expect(mobile.consentPolicy).toBe("explicit");
  });
});
