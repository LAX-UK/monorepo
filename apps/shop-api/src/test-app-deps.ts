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
      SHOP_FAKE_CHECKOUT_ENABLED: false,
      DOMAIN_EVENT_PUBLISH_VALIDATE: "off",
      SHOP_ADMIN_ENABLED: false,
      SHOP_PORTAL_OWNERSHIP_ENABLED: false,
      SHOP_PAYOUTS_ENABLED: false,
      SHOP_THIRD_PARTY_ENABLED: false,
      SHOP_ORIGINALS_ENABLED: false,
      SHOP_MERCHANDISE_ENABLED: false,
      SHOP_PERSONALISED_GOODS_CANCELLATION_EXEMPT: false,
      SHOP_ADMIN_FINANCE_MAX_AUTH_AGE_SECONDS: 900,
      SHOP_OPS_FINANCE_CLI_ENABLED: false,
      SHOP_OPS_DUAL_CONTROL_PENCE: 500_000,
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
      recordCurrencyViolation: async () => "processed" as const,
      dispatchWebhook: async () => ({ kind: "ignored" as const }),
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
      resumeCheckoutOrder: async () => {
        throw new Error("not implemented");
      },
      cancelCheckoutOrder: async () => undefined,
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
    staffReader: {
      findActiveByIdentitySubject: async () => null,
      brokerCanAccessClientParty: async () => false,
    },
    admin: {
      featureFlags: {
        read: () => ({
          payouts: false,
          thirdPartySales: false,
          originalSales: false,
          merchandise: false,
        }),
      },
      financeMaxAuthAgeSeconds: 900,
      health: {
        checkConnectivity: async () => undefined,
        checkCatalogueSchema: async () => undefined,
      },
      importArtwork: async () => ({
        artworkId: "00000000-0000-4000-8000-000000000001",
        created: true,
        editionCount: 0,
      }),
      grantSaleAuthority: async () => ({
        grantId: "00000000-0000-4000-8000-000000000002",
        artworkId: "00000000-0000-4000-8000-000000000001",
        ownerPartyId: "00000000-0000-4000-8000-000000000003",
        authorisedCount: 0,
        editionNumbersAuthorised: [],
        editionNumbersRevoked: [],
      }),
      staffReader: {
        findActiveByIdentitySubject: async () => null,
        brokerCanAccessClientParty: async () => false,
      },
      createProductionTask: async () => ({
        taskId: "00000000-0000-4000-8000-000000000010",
        status: "queued" as const,
      }),
      updateFulfilment: async () => ({
        fulfilmentId: "00000000-0000-4000-8000-000000000011",
        status: "pending_production",
      }),
      recordPossession: async () => ({
        fulfilmentId: "00000000-0000-4000-8000-000000000011",
        status: "delivered",
      }),
      cancelAfterPossession: async () => ({
        returnId: "00000000-0000-4000-8000-000000000013",
        refundId: "00000000-0000-4000-8000-000000000014",
        status: "requested" as const,
      }),
      createStockHold: async () => ({
        holdId: "00000000-0000-4000-8000-000000000014",
        status: "active" as const,
      }),
      requestRefund: async () => ({
        refundId: "00000000-0000-4000-8000-000000000012",
        status: "pending" as const,
      }),
      markPayoutPaid: async () => ({
        payoutId: "00000000-0000-4000-8000-000000000016",
        status: "paid" as const,
      }),
      saleFees: {
        approveFee: async () => ({
          feeId: "00000000-0000-4000-8000-000000000017",
          status: "approved" as const,
        }),
      },
      stockHolds: {
        createHold: async () => ({
          holdId: "00000000-0000-4000-8000-000000000013",
          status: "active",
        }),
        releaseHold: async () => ({
          holdId: "00000000-0000-4000-8000-000000000013",
          status: "released",
        }),
      },
      thirdPartySales: {
        recordSale: async () => ({
          saleId: "00000000-0000-4000-8000-000000000014",
          status: "draft",
        }),
      },
      originalSales: {
        createReservation: async () => ({
          originalSaleId: "00000000-0000-4000-8000-000000000015",
          status: "reserved",
        }),
      },
    },
    portal: {
      portalOwnership: {
        listOwnedEditions: async () => [],
        listSaleAuthority: async () => [],
        createSaleAuthorityRequest: async () => ({
          requestId: "00000000-0000-4000-8000-000000000004",
          status: "pending" as const,
        }),
        listPayouts: async () => [],
        listDocuments: async () => [],
      },
    },
    ...overrides,
  };
}
