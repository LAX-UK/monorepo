import type { ShopApiAppDeps } from "./container.js";

export function createMinimalShopApiTestDeps(
  overrides: Partial<ShopApiAppDeps> = {},
): ShopApiAppDeps {
  return {
    env: {
      NODE_ENV: "test",
      PORT: 3011,
      DATABASE_URL_SHOP: "postgresql://shop:shop@localhost:5432/auction",
      LOG_LEVEL: "error",
      SHOP_API_PUBLIC_BASE_URL: "http://localhost:3011",
      SHOP_STOREFRONT_URL: "http://localhost:3020",
      OIDC_ISSUER_URL: "http://localhost:3001",
      SHOP_SCHEDULER_ENABLED: false,
      SHOP_SCHEDULER_INTERVAL_MS: 60_000,
    },
    auth: {
      jwksUrl: "http://localhost:3001/.well-known/jwks.json",
      issuer: "http://localhost:3001",
      bffToken: "test-bff-token-minimum-32-characters-long",
    },
    stripeWebhook: {
      webhookSecret: undefined,
      verifyWebhook: () => {
        throw new Error("Invalid signature");
      },
      parseCheckoutSessionCompleted: () => null,
      parseCheckoutSessionExpired: () => null,
      parseCheckoutSessionAsyncPaymentFailed: () => null,
      completeCheckout: async () => "processed" as const,
      expireCheckout: async () => "processed" as const,
      failCheckout: async () => "processed" as const,
    },
    commerce: {
      getBasket: async () => null,
      upsertBasketLine: async () => {
        throw new Error("not implemented");
      },
      removeBasketLine: async () => {
        throw new Error("not implemented");
      },
      mergeBaskets: async () => {
        throw new Error("not implemented");
      },
      checkoutOrder: async () => {
        throw new Error("not implemented");
      },
      listOrders: async () => ({ items: [] }),
      getOrder: async () => null,
    },
    health: {
      checkConnectivity: async () => undefined,
      checkCatalogueSchema: async () => undefined,
    },
    catalogue: {
      listPublicArtworks: async () => ({ items: [] }),
      getPublicArtwork: async () => null,
      listPublicCategories: async () => ({ items: [] }),
      getPublicCategory: async () => null,
      listPublicArtists: async () => ({ items: [] }),
      getPublicArtist: async () => null,
    },
    interest: {
      registerArtworkInterest: async () => "registered" as const,
      getArtworkInterest: async () => ({ subscribed: false }),
    },
    ...overrides,
  };
}
