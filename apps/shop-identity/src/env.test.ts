import { describe, expect, it } from "vitest";
import { loadShopIdentityEnv } from "./env.js";

describe("loadShopIdentityEnv", () => {
  it("requires Shop OIDC and database settings without an auth DB URL", () => {
    const env = loadShopIdentityEnv({
      OIDC_ISSUER_URL: "https://auth.example.test",
      OIDC_CLIENT_ID: "lax-shop-web",
      OIDC_CLIENT_SECRET: "super-secret-client-value-32-characters",
      OIDC_REDIRECT_URI: "http://localhost:3010/auth/callback",
      OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3020/signed-out",
      SHOP_STOREFRONT_URL: "http://localhost:3020",
      DATABASE_URL_SHOP: "postgres://shop:shop@127.0.0.1:5432/shop",
    });

    expect(env.PORT).toBe(3010);
    expect(env.DATABASE_URL_SHOP).toContain("shop");
    expect("DATABASE_URL_AUTH" in env).toBe(false);
  });

  it("accepts the lax-art-web client for the lax.art deployment in production", () => {
    const env = loadShopIdentityEnv({
      NODE_ENV: "production",
      OIDC_ISSUER_URL: "https://auth.lax.bid",
      OIDC_CLIENT_ID: "lax-art-web",
      OIDC_CLIENT_SECRET: "super-secret-client-value-32-characters",
      OIDC_REDIRECT_URI: "https://lax.art/auth/callback",
      OIDC_POST_LOGOUT_REDIRECT_URI: "https://lax.art/",
      SHOP_STOREFRONT_URL: "https://lax.art",
      SHOP_API_BFF_TOKEN: "bff-token-value-with-at-least-32-characters",
      SHOP_IDENTITY_TOKEN_ENCRYPTION_KEY: "token-encryption-key",
      DATABASE_URL_SHOP: "postgres://shop:shop@127.0.0.1:5432/shop",
    });
    expect(env.OIDC_CLIENT_ID).toBe("lax-art-web");
  });

  it("rejects the art client with a redirect URI registered only for Shop", () => {
    expect(() =>
      loadShopIdentityEnv({
        OIDC_ISSUER_URL: "https://auth.example.test",
        OIDC_CLIENT_ID: "lax-art-web",
        OIDC_CLIENT_SECRET: "super-secret-client-value-32-characters",
        OIDC_REDIRECT_URI: "https://shop.lax.art/auth/callback",
        OIDC_POST_LOGOUT_REDIRECT_URI: "https://lax.art/",
        DATABASE_URL_SHOP: "postgres://shop:shop@127.0.0.1:5432/shop",
      }),
    ).toThrow("Invalid shop identity environment variables");
  });

  it("requires a registered storefront client in production", () => {
    expect(() =>
      loadShopIdentityEnv({
        NODE_ENV: "production",
        OIDC_ISSUER_URL: "https://auth.lax.bid",
        OIDC_CLIENT_ID: "retired-shop-client",
        OIDC_CLIENT_SECRET: "super-secret-client-value-32-characters",
        OIDC_REDIRECT_URI: "https://shop.lax.art/auth/callback",
        OIDC_POST_LOGOUT_REDIRECT_URI: "https://shop.lax.art/signed-out",
        DATABASE_URL_SHOP: "postgres://shop:shop@127.0.0.1:5432/shop",
      }),
    ).toThrow("Invalid shop identity environment variables");
  });
});
