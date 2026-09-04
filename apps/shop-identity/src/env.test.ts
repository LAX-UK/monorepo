import { describe, expect, it } from "vitest";
import { loadShopIdentityEnv } from "./env.js";

describe("loadShopIdentityEnv", () => {
  it("requires shop OIDC and session settings without auth DB URL", () => {
    const env = loadShopIdentityEnv({
      OIDC_ISSUER_URL: "https://auth.example.test",
      OIDC_CLIENT_ID: "lax-shop-web",
      OIDC_CLIENT_SECRET: "super-secret-client-value-32-characters",
      OIDC_REDIRECT_URI: "https://shop.example.test/callback",
      OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3010/",
      SESSION_SECRET: "01234567890123456789012345678901",
      DATABASE_URL_SHOP: "postgres://shop:shop@127.0.0.1:5432/shop",
    });

    expect(env.PORT).toBe(3010);
    expect(env.DATABASE_URL_SHOP).toContain("shop");
    expect("DATABASE_URL_AUTH" in env).toBe(false);
  });

  it("requires the promoted lax-shop-web client in production", () => {
    expect(() =>
      loadShopIdentityEnv({
        NODE_ENV: "production",
        OIDC_ISSUER_URL: "https://auth.lax.bid",
        OIDC_CLIENT_ID: "retired-shop-client",
        OIDC_CLIENT_SECRET: "super-secret-client-value-32-characters",
        OIDC_REDIRECT_URI: "https://shop.lax.art/auth/callback",
        OIDC_POST_LOGOUT_REDIRECT_URI: "https://shop.lax.art/",
        SESSION_SECRET: "01234567890123456789012345678901",
        DATABASE_URL_SHOP: "postgres://shop:shop@127.0.0.1:5432/shop",
      }),
    ).toThrow("Invalid shop identity environment variables");
  });
});
