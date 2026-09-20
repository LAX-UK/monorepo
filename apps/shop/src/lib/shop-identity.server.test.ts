import { describe, expect, it } from "vitest";
import {
  SHOP_IDENTITY_SESSION_COOKIE,
  fetchShopIdentityMe,
  interpretShopIdentityMeResponse,
  shopIdentityBaseUrl,
  shopIdentityCookieHeader,
  shopIdentityUrl,
} from "./shop-identity.server.js";

describe("shopIdentityBaseUrl", () => {
  it("normalizes configured base URL", () => {
    process.env.SHOP_IDENTITY_BASE_URL = "https://test-shop.lax.bid/";
    expect(shopIdentityBaseUrl()).toBe("https://test-shop.lax.bid");
  });
});

describe("shopIdentityUrl", () => {
  it("joins configured base URL with BFF paths", () => {
    process.env.SHOP_IDENTITY_BASE_URL = "https://test-shop.lax.bid";
    expect(shopIdentityUrl("/me")).toBe("https://test-shop.lax.bid/me");
  });
});

describe("shopIdentityCookieHeader", () => {
  it("forwards only Shop Identity BFF cookies", () => {
    expect(
      shopIdentityCookieHeader([
        { name: SHOP_IDENTITY_SESSION_COOKIE, value: "abc" },
        { name: "unrelated", value: "drop" },
        { name: "shop_identity_id_token", value: "def" },
      ]),
    ).toBe("shop_identity_session=abc; shop_identity_id_token=def");
  });
});

describe("interpretShopIdentityMeResponse", () => {
  it("treats guest 401 as successful session read", () => {
    const result = interpretShopIdentityMeResponse(401, { authenticated: false });
    expect(result.sessionLookupOk).toBe(true);
    expect(result.payload?.authenticated).toBe(false);
  });

  it("treats disabled 403 as successful session read", () => {
    const result = interpretShopIdentityMeResponse(403, {
      authenticated: false,
      reason: "identity_disabled",
    });
    expect(result.sessionLookupOk).toBe(true);
    expect(result.payload?.reason).toBe("identity_disabled");
  });

  it("treats 5xx as transport failure", () => {
    expect(interpretShopIdentityMeResponse(503, null).sessionLookupOk).toBe(false);
  });

  it("treats malformed body as failure", () => {
    expect(interpretShopIdentityMeResponse(401, { bad: true }).sessionLookupOk).toBe(false);
  });
});

describe("fetchShopIdentityMe", () => {
  it("maps fetch errors to transport failure", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error("network"));
    try {
      expect(await fetchShopIdentityMe(undefined)).toEqual({
        sessionLookupOk: false,
        payload: null,
      });
    } finally {
      globalThis.fetch = original;
    }
  });
});
