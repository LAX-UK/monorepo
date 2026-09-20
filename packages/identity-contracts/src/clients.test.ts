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
      "shop.read",
      "shop.write",
    ]);
    expect(shop.allowedScopes).not.toContain("bid.read");
    expect(shop.backchannelLogoutUri).toBe("https://shop.lax.art/api/auth/backchannel-logout");
    expect(shop.backchannelLogoutSessionRequired).toBe(true);
    expect(shop.postLogoutRedirectUris).toEqual([
      "http://localhost:3010/",
      "http://localhost:3020/",
      "https://shop.lax.art/",
      "https://test-shop.lax.bid/",
    ]);
    expect(shop.testBackchannelLogoutUri).toBe(
      "https://test-shop.lax.bid/api/auth/backchannel-logout",
    );
    expect(shop.consentPolicy).toBe("implicit");
  });

  it("pre-authorizes only Bid and Shop web clients", () => {
    expect(oidcClientIdsWithImplicitConsent()).toEqual(["lax-bid-web", "lax-shop-web"]);
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
