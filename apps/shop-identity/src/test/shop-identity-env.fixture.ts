import type { ShopIdentityEnv } from "../env.js";

export const testShopIdentityEnv: ShopIdentityEnv = {
  NODE_ENV: "test",
  PORT: 3010,
  OIDC_ISSUER_URL: "https://identity.example",
  OIDC_CLIENT_ID: "lax-shop-web",
  OIDC_CLIENT_SECRET: "a-secret-longer-than-thirty-two-characters",
  OIDC_REDIRECT_URI: "http://localhost:3010/auth/callback",
  OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3020/",
  SHOP_STOREFRONT_URL: "http://localhost:3020",
  SHOP_API_BASE_URL: "http://localhost:3011",
  SHOP_API_BFF_TOKEN: "test-bff-token-minimum-32-characters-long",
  DATABASE_URL_SHOP: "postgres://shop:test@localhost/shop",
  FEDCM_ENABLED: false,
};
