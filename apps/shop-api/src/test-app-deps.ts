import { legalEntityFor } from "@auction/branding";
import { createArtistApplicantService } from "./application/artist-applications/artist-applicant.service.js";
import { createArtistApplicationRateLimiters } from "./application/artist-applications/artist-application-rate-limits.js";
import { createArtistApplicationReviewService } from "./application/artist-applications/artist-application-review.service.js";
import { createEnquiryInboxService } from "./application/enquiry-inbox.service.js";
import {
  createEditionAlertRateLimiter,
  createEnquiryRateLimiter,
} from "./application/enquiry-rate-limit.js";
import { GuestErasureService } from "./application/guest-erasure/guest-erasure.service.js";
import { createHomeFeaturesService } from "./application/home-features/home-features.service.js";
import { LeadsService } from "./application/leads/leads.service.js";
import { createProductionTaskService } from "./application/production-task.service.js";
import { createSavedViewService } from "./application/saved-view.service.js";
import type { ShopApiAppDeps } from "./container.js";
import { createInMemoryFixedWindowCounter } from "./infrastructure/in-memory-fixed-window-counter.js";
import { createInMemoryArtistApplications } from "./test-support/in-memory-artist-applications.js";
import { createInMemorySavedViewRepository } from "./test-support/in-memory-saved-view-repository.js";
import { createStubEnquiryInboxRepository } from "./test-support/stub-enquiry-inbox-repository.js";
import { createStubProductionTaskRepository } from "./test-support/stub-production-task-repository.js";

export function createMinimalShopApiTestDeps(
  overrides: Partial<ShopApiAppDeps> = {},
): ShopApiAppDeps {
  const artistApplications = createInMemoryArtistApplications();
  const clock = { now: () => new Date() };
  return {
    env: {
      NODE_ENV: "test",
      PORT: 3011,
      DATABASE_URL_SHOP: "postgresql://shop:shop@localhost:5432/auction",
      SHOP_EDITION_ORDER_LIMIT: 2,
      LOG_LEVEL: "error",
      SHOP_API_PUBLIC_BASE_URL: "http://localhost:3011",
      SHOP_STOREFRONT_URL: "http://localhost:3020",
      LAX_ART_LEGAL_NAME: legalEntityFor("art").name,
      OIDC_ISSUER_URL: "http://localhost:3001",
      SHOP_SCHEDULER_ENABLED: false,
      SHOP_SCHEDULER_INTERVAL_MS: 60_000,
      SHOP_REQUIRE_STRIPE: true,
      SHOP_FAKE_CHECKOUT_ENABLED: false,
      DOMAIN_EVENT_PUBLISH_VALIDATE: "off",
      SHOP_ADMIN_ENABLED: false,
      SHOP_PORTAL_OWNERSHIP_ENABLED: false,
      SHOP_PAYOUTS_ENABLED: false,
      SHOP_THIRD_PARTY_ENABLED: false,
      SHOP_ORIGINALS_ENABLED: false,
      SHOP_MERCHANDISE_ENABLED: false,
      SHOP_EDITORIAL_ENABLED: false,
      SHOP_PERSONALISED_GOODS_CANCELLATION_EXEMPT: false,
      SHOP_ADMIN_FINANCE_MAX_AUTH_AGE_SECONDS: 900,
      SHOP_OPS_FINANCE_CLI_ENABLED: false,
      SHOP_OPS_DUAL_CONTROL_PENCE: 500_000,
      STRIPE_SHOP_CONNECT_PLATFORM_KEY: "bid_sandbox",
      SHOP_CONNECT_TRANSFERS_ENABLED: false,
      SHOP_FINANCIAL_YEAR_END: { month: 9, day: 30 },
    },
    auth: {
      jwksUrl: "http://localhost:3001/.well-known/jwks.json",
      issuer: "http://localhost:3001",
      bffToken: "test-bff-token-minimum-32-characters-long",
    },
    identityDeletion: {
      eligibility: { listBlockers: async () => [] },
      machine: { clientId: undefined, clientSecret: undefined },
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
      merchandiseEnabled: false,
      editionOrderLimit: 2,
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
      getCustomerProfile: async () => ({ name: null, email: null }),
      invoiceIssuer: { supplier: legalEntityFor("shop"), vatNumber: null },
    },
    health: {
      checkConnectivity: async () => undefined,
      checkCatalogueSchema: async () => undefined,
    },
    catalogue: {
      listPublicArtworks: async () => ({ items: [] }),
      getPublicArtwork: async () => null,
      listArtworkObjectTypeFacets: async () => [],
      countArtworkFacets: async () => ({
        availability: { available: 0, soldOut: 0 },
        categories: [],
        artists: [],
        priceBands: [],
        sizes: [],
        techniques: [],
      }),
      listPublicCategories: async () => ({ items: [] }),
      getPublicCategory: async () => null,
      listPublicArtists: async () => ({ items: [] }),
      getPublicArtist: async () => null,
    },
    merchandise: {
      listPublicMerchandiseProducts: async () => ({ items: [] }),
      getPublicMerchandiseProduct: async () => null,
    },
    artistApplicant: createArtistApplicantService({
      uow: artistApplications.uow,
      uploads: artistApplications.uploads,
      rateLimiters: createArtistApplicationRateLimiters(createInMemoryFixedWindowCounter()),
      clock,
    }),
    interest: {
      registerArtworkInterest: async () => ({ status: "registered" as const, reference: "E-2041" }),
      getArtworkInterest: async () => ({ subscribed: false }),
      enquiryRateLimiter: createEnquiryRateLimiter(createInMemoryFixedWindowCounter()),
      editionAlerts: {
        register: async () => "registered" as const,
        listForSubject: async () => [],
        cancelForSubject: async () => "not_found" as const,
        previewUnsubscribe: async () => null,
        unsubscribe: async () => null,
      },
      editionAlertRateLimiter: createEditionAlertRateLimiter(createInMemoryFixedWindowCounter()),
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
      stepUpMaxAuthAgeSeconds: 900,
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
      getSaleAuthorityRequest: async () => ({
        requestId: "00000000-0000-4000-8000-000000000004",
        artworkId: "00000000-0000-4000-8000-000000000001",
        ownerPartyId: "00000000-0000-4000-8000-000000000003",
        requestedCount: 1,
        status: "pending",
      }),
      rejectSaleAuthorityRequest: async () => ({
        requestId: "00000000-0000-4000-8000-000000000004",
        status: "rejected" as const,
      }),
      artistApplicationReview: createArtistApplicationReviewService({
        uow: artistApplications.uow,
        queue: {
          list: async () => ({
            items: [],
            nextCursor: null,
            counts: { all: 0, new: 0, in_review: 0, waiting: 0, decided: 0 },
          }),
          getDetail: async () => null,
          countNew: async () => 0,
        },
        reviewers: { list: async () => [], canReview: async () => false },
        clock,
      }),
      productionTasks: createProductionTaskService({
        repository: createStubProductionTaskRepository(),
        staffReader: {
          findActiveByIdentitySubject: async () => null,
          brokerCanAccessClientParty: async () => false,
        },
      }),
      savedViews: createSavedViewService({ repository: createInMemorySavedViewRepository() }),
      leads: new LeadsService({
        list: async () => ({
          rows: [],
          counts: { all: 0, ordered: 0, abandoned_checkout: 0, enquired: 0, joined: 0 },
        }),
        get: async () => null,
      }),
      guestErasure: new GuestErasureService({
        read: async () => null,
        withLockedGuest: async () => null,
      }),
      enquiryInbox: createEnquiryInboxService({
        repository: createStubEnquiryInboxRepository(),
        staffReader: {
          findActiveByIdentitySubject: async () => null,
          brokerCanAccessClientParty: async () => false,
        },
      }),
      adminRead: {
        artworks: {
          listArtworks: async () => ({
            items: [],
            nextCursor: null,
            counts: { live: 0, draft: 0, sold_out: 0, archived: 0 },
          }),
          getArtwork: async () => null,
        },
        orders: {
          listOrders: async () => ({ items: [], nextCursor: null, counts: {} }),
          getOrderDetail: async () => {
            throw new Error("not implemented in test deps");
          },
          readOrderDailyTotals: async () => ({ paid: new Map(), placed: new Map() }),
        },
        fulfilment: { listFulfilment: async () => ({ items: [], nextCursor: null, counts: {} }) },
        payouts: { listPayouts: async () => ({ items: [], nextCursor: null, counts: {} }) },
        sales: {
          listStockHolds: async () => ({ items: [], nextCursor: null, counts: {} }),
          listThirdPartySales: async () => ({ items: [], nextCursor: null, counts: {} }),
          listOriginalSales: async () => ({ items: [], nextCursor: null, counts: {} }),
        },
        parties: {
          listClientParties: async () => ({ items: [], nextCursor: null, counts: {} }),
          listArtists: async () => ({
            items: [],
            nextCursor: null,
            counts: { active: 0, archived: 0 },
          }),
          getClientDetail: async () => {
            throw new Error("not implemented in test deps");
          },
          getArtistDetail: async () => {
            throw new Error("not implemented in test deps");
          },
        },
        saleAuthorityRequests: {
          listRequests: async () => ({ items: [], nextCursor: null, counts: {} }),
          getRequestById: async () => ({
            requestId: "00000000-0000-4000-8000-000000000004",
            artworkId: "00000000-0000-4000-8000-000000000001",
            ownerPartyId: "00000000-0000-4000-8000-000000000003",
            requestedCount: 1,
            status: "pending",
          }),
        },
        staff: { listStaffMembers: async () => ({ items: [], nextCursor: null, counts: {} }) },
        catalogue: {
          listMerchandiseProducts: async () => ({ items: [], nextCursor: null, counts: {} }),
          getMerchandiseProduct: async () => null,
        },
        overview: {
          readOverviewKpis: async (keys) => Object.fromEntries(keys.map((key) => [key, 0])),
          listLowStockRuns: async () => [],
        },
        lookups: {
          searchParties: async () => [],
          searchArtworks: async () => [],
          searchEditions: async () => [],
        },
        compliance: {
          listAuditEntries: async () => ({ items: [], nextCursor: null }),
          readAuditFacets: async () => ({ actions: [], targetTypes: [], actors: [] }),
          listDisputes: async () => ({ items: [], nextCursor: null, counts: {} }),
          readEffectiveSettings: async () => ({
            cancellationDaysAfterPossession: null,
            personalisedGoodsCancellationExempt: false,
            vatStandardRateBp: null,
            payoutsEnabled: false,
            merchandiseEnabled: false,
            originalsEnabled: false,
            thirdPartyEnabled: false,
          }),
        },
      },
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
      adjustMerchandiseStock: async () => ({
        variantId: "00000000-0000-4000-8000-000000000018",
        onHand: 10,
      }),
      createMerchandiseProduct: async () => ({
        productId: "00000000-0000-4000-8000-000000000019",
        variantId: "00000000-0000-4000-8000-000000000018",
        slug: "test-product",
      }),
      merchandiseCatalogue: {
        updateProduct: async () => ({ version: "2026-01-01T00:00:00.000Z" }),
        setProductArchived: async () => ({ version: "2026-01-01T00:00:00.000Z" }),
        addVariant: async () => ({ variantId: "00000000-0000-4000-8000-000000000018" }),
        updateVariant: async () => ({ variantId: "00000000-0000-4000-8000-000000000018" }),
        setVariantArchived: async () => ({ variantId: "00000000-0000-4000-8000-000000000018" }),
      },
      artworkCatalogue: {
        createArtwork: async () => ({
          artworkId: "00000000-0000-4000-8000-000000000021",
          slug: "test-artwork",
          version: "2026-01-01T00:00:00.000Z",
          refreshesArt: false,
        }),
        updateArtwork: async () => ({ version: "2026-01-01T00:00:00.000Z", refreshesArt: false }),
        setPrice: async () => ({ version: "2026-01-01T00:00:00.000Z", refreshesArt: false }),
        setVisibility: async () => ({
          version: "2026-01-01T00:00:00.000Z",
          state: "live" as const,
          refreshesArt: false,
        }),
        applyBulkVisibility: async (input) => ({
          results: input.artworkIds.map((artworkId) => ({
            artworkId,
            outcome: "changed" as const,
          })),
          refreshesArt: false,
        }),
      },
      editionRuns: {
        runs: {
          record: async () => 0,
          replace: async () => ({ version: "2026-01-01T00:00:00.000Z" }),
        },
        facts: {
          apply: async () => "2026-01-01T00:00:00.000Z",
          save: async (input) => ({
            factsVersion: "2026-01-01T00:00:00.000Z",
            confirmed: input.confirmed,
          }),
          correct: async () => ({
            factsVersion: "2026-01-01T00:00:00.000Z",
            confirmed: true,
            affectedOrders: 0,
          }),
          setForRuns: async (input) => ({
            results: input.artworkIds.map((artworkId) => ({
              artworkId,
              outcome: "changed" as const,
            })),
          }),
        },
        stock: {
          apply: async () => ({ batchId: "", firstStockRef: 1, quantity: 0, laxPrintsOnSale: 0 }),
          add: async (input) => ({
            batchId: "00000000-0000-4000-8000-000000000030",
            firstStockRef: 1,
            quantity: input.batch.artistCount + input.batch.laxCount,
            laxPrintsOnSale: input.batch.laxCount,
          }),
        },
        listings: {
          createProofListing: async () => ({
            artworkId: "00000000-0000-4000-8000-000000000031",
            slug: "test-artwork-artists-proof",
            version: "2026-01-01T00:00:00.000Z",
          }),
          createCompanionListing: async (input) => ({
            artworkId: "00000000-0000-4000-8000-000000000032",
            slug: input.slug,
            version: "2026-01-01T00:00:00.000Z",
          }),
        },
      },
      artistCatalogue: {
        createArtist: async () => ({
          artistId: "00000000-0000-4000-8000-000000000020",
          slug: "test-artist",
        }),
        setArtistArchived: async (input) => ({
          artistId: input.artistId,
          archived: input.archived,
          refreshesArt: false,
        }),
      },
      artCache: { invalidateEditorial: async () => {}, invalidateCatalogue: async () => {} },
      homeFeatures: createHomeFeaturesService({
        uow: { run: () => Promise.reject(new Error("No featured lists store in this test")) },
        lists: {
          list: async () => ({
            featured_prints: [],
            featured_artists: [],
            featured_categories: [],
          }),
          searchCandidates: async () => [],
        },
        clock: { now: () => new Date() },
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
        issueInvoice: async () => ({
          originalSaleId: "00000000-0000-4000-8000-000000000015",
          status: "invoiced" as const,
          stripeInvoiceId: "in_test",
          hostedInvoiceUrl: null,
        }),
        completePaidAndAssign: async () => ({
          originalSaleId: "00000000-0000-4000-8000-000000000015",
          status: "assigned" as const,
        }),
      },
      linkArtistIdentity: async () => ({
        artistId: "00000000-0000-4000-8000-000000000020",
        identitySubjectId: "artist-subject",
      }),
      unlinkArtistIdentity: async () => ({
        artistId: "00000000-0000-4000-8000-000000000020",
      }),
      updateArtistSeo: async (artistId) => artistId === "00000000-0000-4000-8000-000000000020",
      shopMediaUpload: null,
    },
    payeeConnect: {
      getClientConfig: () => ({ publishableKey: null, connectConfigured: false }),
      getStatusForSubject: async () => ({
        stripeAccountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        requirementsCurrentlyDue: [],
        disabledReason: null,
        ready: false,
      }),
      ensureAccountForSubject: async () => ({ stripeAccountId: "acct_test" }),
      createOnboardingLinkForSubject: async () => ({
        url: "https://connect.stripe.com/setup/test",
        expiresAt: new Date().toISOString(),
      }),
      createAccountSessionForSubject: async () => ({ clientSecret: "acct_sess_test" }),
    },
    stripeConnectWebhook: {
      webhookSecret: undefined,
      verifyWebhook: () => {
        throw new Error("Stripe Connect webhook not configured in tests");
      },
      syncAccount: async () => "ignored" as const,
    },
    editorial: null,
    portal: {
      artistApplications: { hasApplication: async () => false },
      portalOwnership: {
        listOwnedEditions: async () => [],
        listSaleAuthority: async () => [],
        createSaleAuthorityRequest: async () => ({
          requestId: "00000000-0000-4000-8000-000000000004",
          status: "pending" as const,
        }),
        listSaleAuthorityRequests: async () => [],
        withdrawSaleAuthorityRequest: async (_subject: string, requestId: string) => ({
          requestId,
          status: "cancelled" as const,
        }),
        listPayouts: async () => [],
        listDocuments: async () => [],
        listCollection: async () => [],
        listEnquiries: async () => [],
      },
      portalSales: {
        listSales: async () => [],
      },
      portalArtist: {
        getLinkedArtist: async () => null,
        listArtworks: async () => [],
        listSales: async () => [],
      },
      laxPortfolio: {
        getPortfolio: async () => ({ items: [], partial: true }),
        getMoney: async () => ({ entries: [], partial: true }),
      },
      portalFavorites: {
        listSavedArtworks: async () => [],
        saveArtwork: async () => "saved",
        unsaveArtwork: async () => "removed",
        listFollowedArtists: async () => [],
        followArtist: async () => "followed",
        unfollowArtist: async () => "removed",
      },
    },
    ...overrides,
  };
}
