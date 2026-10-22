import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShopAdminConfig } from "../config";
import { exchangeForShopApiToken } from "./exchange-shop-api-token";

const config = {
  oidcInternalIssuer: "http://auth.internal",
  oidcClientId: "lax-shop-admin",
  oidcClientSecret: "secret",
} as ShopAdminConfig;

afterEach(() => vi.unstubAllGlobals());

describe("exchangeForShopApiToken", () => {
  it("exchanges the ID token for a shop.admin token bound to the Shop API resource", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ access_token: "resource-jwt", token_type: "Bearer", expires_in: 900 }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await exchangeForShopApiToken({ config, idToken: "id-token" });

    expect(result).toEqual({ accessToken: "resource-jwt", expiresInSeconds: 900 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://auth.internal/api/auth/oauth2/token");
    const body = new URLSearchParams(init.body as URLSearchParams);
    expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:token-exchange");
    expect(body.get("subject_token")).toBe("id-token");
    expect(body.get("resource")).toBe("https://shop.lax.art/api");
    expect(body.get("scope")).toBe("shop.admin");
  });
});
