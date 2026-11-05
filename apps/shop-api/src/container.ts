import { randomUUID } from "node:crypto";
import { ArtworkOfferLock } from "@auction/artwork-register-contracts";
import { type Database, closeDb, createDb } from "@auction/db";
import {
  DrizzleArtworkRegisterQueueReader,
  DrizzleArtworkRegisterRepository,
  DrizzleZohoArtworkSyncStore,
  DrizzleZohoListingRunStore,
} from "@auction/persistence/repositories";
import { sql } from "drizzle-orm";
import { Redis } from "ioredis";
import type { AdminRoutesDeps } from "./admin-route-deps.js";
import { OriginalMoveService } from "./application/admin/original-move.service.js";
import { ReopenArtListingService } from "./application/admin/reopen-art-listing.service.js";
import { createAlertingPortalFavorites } from "./application/alerts/alerting-portal-favorites.js";
import type { ArtistApplicantService } from "./application/artist-applications/artist-applicant.service.js";
import { ArtworkRegisterReviewService } from "./application/artwork-register/artwork-register-review.service.js";
import {
  ArtworkZohoLinkService,
  withZohoLinks,
} from "./application/artwork-register/artwork-zoho-link.service.js";
import { OfferOnLaxArtService } from "./application/artwork-register/offer-on-lax-art.service.js";
import { createShopDeletionEligibilityService } from "./application/deletion-eligibility.service.js";
import { createEditionRunServices } from "./application/edition-runs/edition-run-services.js";
import { createEditorialLinksService } from "./application/editorial-links.service.js";
import { createEnquiryInboxService } from "./application/enquiry-inbox.service.js";
import {
  createEditionAlertRateLimiter,
  createEnquiryRateLimiter,
  createReleaseAlertRateLimiter,
} from "./application/enquiry-rate-limit.js";
import { GuestErasureService } from "./application/guest-erasure/guest-erasure.service.js";
import { createCountArtworkFacetsHandler } from "./application/handlers/count-artwork-facets.handler.js";
import { createEditionAlertHandlers } from "./application/handlers/edition-alerts.handler.js";
import { createGetArtworkInterestHandler } from "./application/handlers/get-artwork-interest.handler.js";
import { createGetPublicArtistHandler } from "./application/handlers/get-public-artist.handler.js";
import { createGetPublicArtworkHandler } from "./application/handlers/get-public-artwork.handler.js";
import { createGetPublicCategoryHandler } from "./application/handlers/get-public-category.handler.js";
import { createGetPublicMerchandiseProductHandler } from "./application/handlers/get-public-merchandise-product.handler.js";
import { createImportArtworkHandler } from "./application/handlers/import-artwork.handler.js";
import { createListArtworkObjectTypeFacetsHandler } from "./application/handlers/list-artwork-object-type-facets.handler.js";
import { createListPublicArtistsHandler } from "./application/handlers/list-public-artists.handler.js";
import { createListPublicArtworksHandler } from "./application/handlers/list-public-artworks.handler.js";
import { createListPublicCategoriesHandler } from "./application/handlers/list-public-categories.handler.js";
import { createListPublicMerchandiseProductsHandler } from "./application/handlers/list-public-merchandise-products.handler.js";
import { createPortalFavoritesHandlers } from "./application/handlers/portal-favorites.handler.js";
import { createRegisterArtworkInterestHandler } from "./application/handlers/register-artwork-interest.handler.js";
import { createShopMediaUploadHandlers } from "./application/handlers/shop-media-upload.handler.js";
import { createHomeFeaturesService } from "./application/home-features/home-features.service.js";
import { createLaxPortfolioHandlers } from "./application/lax-portfolio/lax-portfolio.handler.js";
import { LeadsService } from "./application/leads/leads.service.js";
import type { ImportArtworkCommand } from "./application/ports/artwork-import.writer.js";
import type { CreateOriginalSaleCommand } from "./application/ports/original-sale.writer.js";
import type {
  GrantSaleAuthorityCommand,
  SaleAuthorityWriter,
} from "./application/ports/sale-authority.writer.js";
import type { ApproveSaleFeeCommand } from "./application/ports/sale-fee.writer.js";
import type { ShopPayeeConnectPort } from "./application/ports/shop-payee-connect.port.js";
import type {
  CreateStockHoldCommand,
  ReleaseStockHoldCommand,
} from "./application/ports/stock-hold.writer.js";
import type { RecordThirdPartySaleCommand } from "./application/ports/third-party-sale.writer.js";
import { createProductionTaskService } from "./application/production-task.service.js";
import { createSavedViewService } from "./application/saved-view.service.js";
import { SubjectExportService } from "./application/subject-export/subject-export.service.js";
import type { CatalogueRoutesDeps } from "./catalogue-route-deps.js";
import type { CommerceRoutesDeps, StripeWebhookDeps } from "./commerce-route-deps.js";
import { createCommerceServices } from "./create-commerce-services.js";
import { resolveStorefrontOrigins } from "./domain/storefront-origins.js";
import type { EditorialRoutesDeps } from "./editorial-route-deps.js";
import type { ShopApiEnv } from "./env.js";
import type {
  IdentityDeletionRouteDeps,
  IdentitySubjectExportRouteDeps,
} from "./identity-route-deps.js";
import { createShopAlertRuntime } from "./infrastructure/alerts/create-shop-alert-runtime.js";
import { createArtistApplicationServices } from "./infrastructure/artist-applications/create-artist-application-services.js";
import { createDrizzleAdminReadRepository } from "./infrastructure/drizzle-admin-read.repository.js";
import { createDrizzleArtListingLookup } from "./infrastructure/drizzle-art-listing-lookup.js";
import { createDrizzleArtistCatalogueWriter } from "./infrastructure/drizzle-artist-catalogue.writer.js";
import { createDrizzleArtistDirectoryRepository } from "./infrastructure/drizzle-artist-directory.repository.js";
import { createDrizzleArtistSeoWriter } from "./infrastructure/drizzle-artist-seo.repository.js";
import { createDrizzleArtworkCatalogueRepository } from "./infrastructure/drizzle-artwork-catalogue.repository.js";
import { createDrizzleArtworkCatalogueWriter } from "./infrastructure/drizzle-artwork-catalogue.writer.js";
import { createDrizzleArtworkImportRepository } from "./infrastructure/drizzle-artwork-import.repository.js";
import { createDrizzleArtworkInterestRepository } from "./infrastructure/drizzle-artwork-interest.repository.js";
import { createDrizzleCategoryCatalogueRepository } from "./infrastructure/drizzle-category-catalogue.repository.js";
import { createDrizzleDeletionEligibilityRepository } from "./infrastructure/drizzle-deletion-eligibility.repository.js";
import { createDrizzleEditionAlertStore } from "./infrastructure/drizzle-edition-alert.store.js";
import { createDrizzleEditorialLinksRepository } from "./infrastructure/drizzle-editorial-links.repository.js";
import { createDrizzleEditorialSearchReader } from "./infrastructure/drizzle-editorial-search.reader.js";
import { createDrizzleEditorialRepository } from "./infrastructure/drizzle-editorial.repository.js";
import { createDrizzleEnquiryInboxRepository } from "./infrastructure/drizzle-enquiry-inbox.repository.js";
import { createDrizzleHelpRepository } from "./infrastructure/drizzle-help.repository.js";
import {
  createDrizzleLaxArtArtistDirectory,
  createDrizzleLaxArtDraftWriter,
  createDrizzleLaxArtListingReader,
} from "./infrastructure/drizzle-lax-art-offer.js";
import { createDrizzleLeadReader } from "./infrastructure/drizzle-lead.reader.js";
import { createDrizzleMerchandiseCatalogueRepository } from "./infrastructure/drizzle-merchandise-catalogue.repository.js";
import { createDrizzleMerchandiseCatalogueWriter } from "./infrastructure/drizzle-merchandise-catalogue.writer.js";
import { createDrizzleMerchandiseStockWriter } from "./infrastructure/drizzle-merchandise-stock.writer.js";
import { createDrizzleOrderProblemReportWriter } from "./infrastructure/drizzle-order-problem-report.writer.js";
import { createDrizzleOriginalMoveReader } from "./infrastructure/drizzle-original-move.reader.js";
import { createDrizzlePortalArtistRepository } from "./infrastructure/drizzle-portal-artist.repository.js";
import { createDrizzlePortalFavoritesRepository } from "./infrastructure/drizzle-portal-favorites.repository.js";
import { createDrizzlePortalOwnershipRepository } from "./infrastructure/drizzle-portal-ownership.repository.js";
import { createDrizzlePortalPortfolioRepository } from "./infrastructure/drizzle-portal-portfolio.repository.js";
import { createDrizzlePortalSalesRepository } from "./infrastructure/drizzle-portal-sales.repository.js";
import { createDrizzleProductionTaskRepository } from "./infrastructure/drizzle-production-task.repository.js";
import { createDrizzleSaleAuthorityWriter } from "./infrastructure/drizzle-sale-authority.writer.js";
import { createDrizzleSavedViewRepository } from "./infrastructure/drizzle-saved-view.repository.js";
import { createDrizzleShopMediaAssetRepository } from "./infrastructure/drizzle-shop-media-asset.repository.js";
import { createDrizzleShopNotificationPublisher } from "./infrastructure/drizzle-shop-notification.publisher.js";
import { createDrizzleShopPayeeConnectAccountRepository } from "./infrastructure/drizzle-shop-payee-connect-account.repository.js";
import { createDrizzleShopPayeeConnectService } from "./infrastructure/drizzle-shop-payee-connect.service.js";
import {
  createDrizzleSaleFeeWriter,
  createDrizzleStockHoldWriter,
  createDrizzleThirdPartySaleWriter,
} from "./infrastructure/drizzle-shop-phase-writers.js";
import { createDrizzleShopReadinessAdapter } from "./infrastructure/drizzle-shop-readiness.adapter.js";
import { createDrizzleShopStaffMemberReader } from "./infrastructure/drizzle-shop-staff-member.reader.js";
import { createDrizzleShopUnitOfWork } from "./infrastructure/drizzle-shop-transaction-effects.js";
import { createDrizzleStaffNameReader } from "./infrastructure/drizzle-staff-name.reader.js";
import { createDrizzleStorefrontCurationWriter } from "./infrastructure/drizzle-storefront-curation.repository.js";
import { createDrizzleEditionRunUnitOfWork } from "./infrastructure/edition-runs/drizzle-edition-run.unit-of-work.js";
import { createEnquiryFollowUp } from "./infrastructure/enquiry-follow-up.js";
import { grantShopStaffRole } from "./infrastructure/grant-staff-role.js";
import { createDrizzleGuestErasureStore } from "./infrastructure/guest-checkout/drizzle-guest-erasure.store.js";
import { createAdjustMerchandiseStockHandler } from "./infrastructure/handlers/admin/adjust-merchandise-stock.handler.js";
import { createAdvanceReturnHandler } from "./infrastructure/handlers/admin/advance-return.handler.js";
import { createCancelAfterPossessionHandler } from "./infrastructure/handlers/admin/cancel-after-possession.handler.js";
import { createCreateMerchandiseProductHandler } from "./infrastructure/handlers/admin/create-merchandise-product.handler.js";
import { createCreateProductionTaskHandler } from "./infrastructure/handlers/admin/create-production-task.handler.js";
import { createCreateStockHoldHandler } from "./infrastructure/handlers/admin/create-stock-hold.handler.js";
import {
  createLinkArtistIdentityHandler,
  createUnlinkArtistIdentityHandler,
} from "./infrastructure/handlers/admin/link-artist-identity.handler.js";
import { createMarkPayoutPaidHandler } from "./infrastructure/handlers/admin/mark-payout-paid.handler.js";
import { createMarkRefundSettledOutsideHandler } from "./infrastructure/handlers/admin/mark-refund-settled-outside.handler.js";
import { createRecordPossessionHandler } from "./infrastructure/handlers/admin/record-possession.handler.js";
import { createRejectSaleAuthorityRequestHandler } from "./infrastructure/handlers/admin/reject-sale-authority-request.handler.js";
import { createRequestRefundHandler } from "./infrastructure/handlers/admin/request-refund.handler.js";
import { createRetryRefundHandler } from "./infrastructure/handlers/admin/retry-refund.handler.js";
import { createUpdateFulfilmentHandler } from "./infrastructure/handlers/admin/update-fulfilment.handler.js";
import { createSyncConnectAccountHandler } from "./infrastructure/handlers/webhooks/sync-connect-account.handler.js";
import { createDrizzleHomeFeatureListReader } from "./infrastructure/home-features/drizzle-home-feature.reader.js";
import { createDrizzleHomeFeaturesUnitOfWork } from "./infrastructure/home-features/drizzle-home-features.unit-of-work.js";
import {
  createHttpArtCacheInvalidator,
  noopArtCacheInvalidator,
} from "./infrastructure/http-art-cache-invalidator.js";
import { createHttpAuctionOfferGateway } from "./infrastructure/http-auction-offer.gateway.js";
import { idempotentAdminCommand } from "./infrastructure/idempotent-admin-command.js";
import { createInMemoryFixedWindowCounter } from "./infrastructure/in-memory-fixed-window-counter.js";
import { createDrizzleOriginalSaleWriter } from "./infrastructure/phase/drizzle-original-sale.writer.js";
import { createRedisFixedWindowCounter } from "./infrastructure/redis-fixed-window-counter.js";
import { createRegisterOriginalOffers } from "./infrastructure/register-original-offers.js";
import { seedAcceptancePortalFixtures } from "./infrastructure/seed/acceptance-portal-seed.js";
import { seedShopFoundationCatalogue } from "./infrastructure/seed/catalogue-seed.js";
import { seedShopStorefrontCuration } from "./infrastructure/seed/storefront-curation-seed.js";
import { createSharpImageProbe } from "./infrastructure/sharp-image-probe.js";
import { loadShopCancellationPolicy } from "./infrastructure/shop-cancellation-policy.js";
import { resolveShopDocumentStorageConfig } from "./infrastructure/shop-document-storage-config.js";
import { createShopFeatureFlagsReader } from "./infrastructure/shop-feature-flags-env.js";
import { resolveShopMediaStorage } from "./infrastructure/shop-media-storage.js";
import { assertShopVatPolicyWhenPayoutsEnabled } from "./infrastructure/shop-vat-policy.js";
import { createStripeShopConnectGateway } from "./infrastructure/stripe-shop-connect.gateway.js";
import { createStripeShopInvoiceGateway } from "./infrastructure/stripe-shop-invoice.gateway.js";
import { constructStripeWebhookEvent } from "./infrastructure/stripe-webhook-verifier.js";
import { createShopSubjectExportRegistry } from "./infrastructure/subject-export/create-shop-subject-export-categories.js";
import {
  SubjectExportFileSigner,
  unconfiguredSubjectExportStorage,
} from "./infrastructure/subject-export/subject-export-file-signer.js";
import type { InterestRoutesDeps } from "./interest-route-deps.js";
import type { InventoryRouteDeps } from "./inventory-route-deps.js";
import type { MerchandiseRoutesDeps } from "./merchandise-route-deps.js";
import type { PortalRoutesDeps } from "./portal-route-deps.js";
import { resolveShopMediaPublicUrl } from "./presenters/resolve-shop-media-url.js";
import type { StripeConnectWebhookDeps } from "./routes/webhooks/stripe-connect.routes.js";

export type ShopApiAppDeps = {
  env: ShopApiEnv;
  health: {
    checkConnectivity(): Promise<void>;
    checkCatalogueSchema(): Promise<void>;
  };
  catalogue: CatalogueRoutesDeps;
  merchandise: MerchandiseRoutesDeps;
  interest: InterestRoutesDeps;
  /** The signed-in artist's own application to join the gallery. */
  artistApplicant: ArtistApplicantService;
  commerce: CommerceRoutesDeps;
  stripeWebhook: StripeWebhookDeps;
  auth: {
    jwksUrl: string;
    issuer: string;
    bffToken?: string | undefined;
  };
  admin: AdminRoutesDeps;
  portal: PortalRoutesDeps;
  identityDeletion: IdentityDeletionRouteDeps;
  inventory: InventoryRouteDeps;
  identitySubjectExport: IdentitySubjectExportRouteDeps;
  payeeConnect: ShopPayeeConnectPort;
  stripeConnectWebhook: StripeConnectWebhookDeps;
  staffReader: AdminRoutesDeps["staffReader"];
  editorial: EditorialRoutesDeps | null;
};

export type ShopApiContainer = {
  db: Database;
  app: ShopApiAppDeps;
  importArtwork: ReturnType<typeof createImportArtworkHandler>;
  grantStaffRole(input: {
    subject: string;
    role: import("@auction/shop-domain").ShopStaffRole;
    operatorSubjectId: string;
  }): Promise<void>;
  grantSaleAuthority: SaleAuthorityWriter["grantSaleAuthority"];
  seedCatalogue(): Promise<void>;
  seedAcceptancePortal(identitySubjectId: string, displayName?: string): Promise<void>;
  reportPhase2BackfillDryRun(): Promise<unknown[]>;
  queueFinanceOpsAlert(input: {
    idempotencyKey: string;
    action: string;
    orderId: string;
    detail: string;
    operator: string;
    reason: string;
    host: string;
  }): Promise<void>;
  close(): Promise<void>;
};

const withoutTrailingSlash = (url: string) => url.replace(/\/+$/, "");

export function createShopApiContainer(env: ShopApiEnv): ShopApiContainer {
  assertShopVatPolicyWhenPayoutsEnabled(env);
  const db: Database = createDb(env.DATABASE_URL_SHOP);
  const notifications = createDrizzleShopNotificationPublisher();
  const enquiryFollowUp = createEnquiryFollowUp({
    notifications,
    domainEventMode: env.DOMAIN_EVENT_PUBLISH_VALIDATE,
  });
  const shopMediaStorage = resolveShopMediaStorage(env);
  const resolveMediaUrl = (value: string | null | undefined) =>
    resolveShopMediaPublicUrl(shopMediaStorage?.storage ?? null, value);
  const catalogueReader = createDrizzleArtworkCatalogueRepository(db, { resolveMediaUrl });
  const categoryReader = createDrizzleCategoryCatalogueRepository(db);
  const merchandiseReader = createDrizzleMerchandiseCatalogueRepository(db);
  const artistReader = createDrizzleArtistDirectoryRepository(db, { resolveMediaUrl });
  const artworkImportWriter = createDrizzleArtworkImportRepository(
    db,
    env.DOMAIN_EVENT_PUBLISH_VALIDATE,
  );
  const importArtwork = createImportArtworkHandler(artworkImportWriter);
  const rateLimitRedis = env.REDIS_URL
    ? new Redis(env.REDIS_URL, { enableOfflineQueue: false, maxRetriesPerRequest: 1 })
    : null;
  const rateLimitCounter = rateLimitRedis
    ? createRedisFixedWindowCounter(rateLimitRedis)
    : createInMemoryFixedWindowCounter();
  const originalOffers = createRegisterOriginalOffers(
    (session) => new ArtworkOfferLock(new DrizzleArtworkRegisterRepository(session)),
  );
  const { commerce, stripeWebhook } = createCommerceServices(db, env, {
    rateLimitCounter,
    originalOffers,
  });
  const readiness = createDrizzleShopReadinessAdapter(db);
  const storefrontOrigins = resolveStorefrontOrigins({
    shopStorefrontUrl: env.SHOP_STOREFRONT_URL,
    laxArtPublicUrl: env.LAX_ART_PUBLIC_URL,
  });
  const artworkInterestWriter = createDrizzleArtworkInterestRepository(db, {
    notifications,
    followUp: enquiryFollowUp,
    storefrontOrigins,
    domainEventMode: env.DOMAIN_EVENT_PUBLISH_VALIDATE,
    ...(env.SHOP_ENQUIRY_NOTIFICATION_EMAIL
      ? { enquiryOpsEmail: env.SHOP_ENQUIRY_NOTIFICATION_EMAIL }
      : {}),
  });
  const enquiryRateLimiter = createEnquiryRateLimiter(rateLimitCounter);
  const editionAlertRateLimiter = createEditionAlertRateLimiter(rateLimitCounter);
  const editionAlerts = createEditionAlertHandlers({
    artworks: artworkInterestWriter,
    alerts: createDrizzleEditionAlertStore(db, {
      resolveMediaUrl,
      domainEventMode: env.DOMAIN_EVENT_PUBLISH_VALIDATE,
    }),
  });
  const releaseAlertRateLimiter = createReleaseAlertRateLimiter(rateLimitCounter);
  const shopAlerts = createShopAlertRuntime({
    db,
    env,
    origins: storefrontOrigins,
    resolveMediaUrl,
    log: {
      info: (fields, message) => console.info(message, fields),
      warn: (fields, message) => console.warn(message, fields),
    },
  });
  const releaseAlerts = shopAlerts.handlers;
  const internalBase = env.OIDC_INTERNAL_BASE_URL ?? env.OIDC_ISSUER_URL;
  const jwksUrl = `${internalBase.replace(/\/+$/, "")}/.well-known/jwks.json`;
  const staffReader = createDrizzleShopStaffMemberReader(db);
  const saleAuthorityWriter = createDrizzleSaleAuthorityWriter(
    db,
    env.DOMAIN_EVENT_PUBLISH_VALIDATE,
  );
  const portalOwnership = createDrizzlePortalOwnershipRepository(db, {
    documentStorage: resolveShopDocumentStorageConfig(env),
  });
  const portalSales = createDrizzlePortalSalesRepository(db);
  const laxPortfolio = createLaxPortfolioHandlers({
    reader: createDrizzlePortalPortfolioRepository(db),
    flags: {
      portalOwnershipEnabled: env.SHOP_PORTAL_OWNERSHIP_ENABLED,
      payoutsEnabled: env.SHOP_PAYOUTS_ENABLED,
    },
    context: {
      shopOrigin: withoutTrailingSlash(env.SHOP_STOREFRONT_URL),
      artOrigin: withoutTrailingSlash(env.LAX_ART_PUBLIC_URL ?? env.SHOP_STOREFRONT_URL),
      legalName: env.LAX_ART_LEGAL_NAME,
    },
    resolveMediaUrl,
  });
  const portalArtist = createDrizzlePortalArtistRepository(db);
  const portalFavorites = createAlertingPortalFavorites(
    createPortalFavoritesHandlers(createDrizzlePortalFavoritesRepository(db)),
    shopAlerts.followAlerts,
  );
  const artworkRegisterRepository = new DrizzleArtworkRegisterRepository(db);
  const laxArtListings = createDrizzleLaxArtListingReader(db);
  const baseAdminRead = createDrizzleAdminReadRepository(db, env, { resolveMediaUrl });
  const adminRead = {
    ...baseAdminRead,
    artworks: withZohoLinks(baseAdminRead.artworks, {
      links: new ArtworkZohoLinkService({
        register: artworkRegisterRepository,
        staffNames: createDrizzleStaffNameReader(db),
      }),
      listings: laxArtListings,
    }),
  };
  const shopUow = createDrizzleShopUnitOfWork(db, env.DOMAIN_EVENT_PUBLISH_VALIDATE);
  const cancellationPolicy = loadShopCancellationPolicy(env);
  const createProductionTask = createCreateProductionTaskHandler({ uow: shopUow });
  const requestRefund = createRequestRefundHandler({ uow: shopUow });
  const retryRefund = createRetryRefundHandler({ uow: shopUow });
  const markRefundSettledOutside = createMarkRefundSettledOutsideHandler({ uow: shopUow });
  const advanceReturn = createAdvanceReturnHandler({ uow: shopUow });
  const markPayoutPaid = createMarkPayoutPaidHandler({ uow: shopUow });
  const updateFulfilment = createUpdateFulfilmentHandler({
    uow: shopUow,
    storefrontUrl: env.SHOP_STOREFRONT_URL,
  });
  const recordPossession = createRecordPossessionHandler({
    uow: shopUow,
    policy: cancellationPolicy,
  });
  const cancelAfterPossession = createCancelAfterPossessionHandler({ uow: shopUow });
  const rejectSaleAuthorityRequest = createRejectSaleAuthorityRequestHandler({ uow: shopUow });
  const linkArtistIdentity = createLinkArtistIdentityHandler({ uow: shopUow });
  const unlinkArtistIdentity = createUnlinkArtistIdentityHandler({ uow: shopUow });
  const artistSeoWriter = createDrizzleArtistSeoWriter(db);
  const eventMode = env.DOMAIN_EVENT_PUBLISH_VALIDATE;
  const createHold = idempotentAdminCommand(
    { uow: shopUow },
    {
      commandType: "stock_hold.create",
      run: (tx, command: CreateStockHoldCommand) =>
        createDrizzleStockHoldWriter(tx, eventMode).createHold(command),
    },
  );
  const stockHolds = {
    releaseHold: idempotentAdminCommand(
      { uow: shopUow },
      {
        commandType: "stock_hold.release",
        run: (tx, command: ReleaseStockHoldCommand) =>
          createDrizzleStockHoldWriter(tx, eventMode).releaseHold(command),
      },
    ),
  };
  const createStockHold = createCreateStockHoldHandler({ createHold, staffReader });
  const saleFees = {
    approveFee: idempotentAdminCommand(
      { uow: shopUow },
      {
        commandType: "sale_fee.approve",
        run: (tx, command: ApproveSaleFeeCommand) =>
          createDrizzleSaleFeeWriter(tx, eventMode).approveFee(command),
      },
    ),
  };
  const thirdPartySales = {
    recordSale: idempotentAdminCommand(
      { uow: shopUow },
      {
        commandType: "third_party_sale.record",
        run: (tx, command: RecordThirdPartySaleCommand) =>
          createDrizzleThirdPartySaleWriter(tx, eventMode).recordSale(command),
      },
    ),
  };
  const adminImportArtwork = idempotentAdminCommand(
    { uow: shopUow },
    {
      commandType: "artwork.import",
      run: (tx, command: ImportArtworkCommand) =>
        createImportArtworkHandler(createDrizzleArtworkImportRepository(tx, eventMode))(command),
    },
  );
  const adminGrantSaleAuthority = idempotentAdminCommand(
    { uow: shopUow },
    {
      commandType: "sale_authority.grant",
      run: (tx, command: GrantSaleAuthorityCommand) =>
        createDrizzleSaleAuthorityWriter(tx, eventMode).grantSaleAuthority(command),
    },
  );
  const merchandiseStock = createDrizzleMerchandiseStockWriter(shopUow);
  const merchandiseCatalogue = createDrizzleMerchandiseCatalogueWriter(shopUow);
  const editionRuns = createEditionRunServices({
    uow: createDrizzleEditionRunUnitOfWork(shopUow),
    clock: { now: () => new Date() },
  });
  const artworkCatalogue = createDrizzleArtworkCatalogueWriter(shopUow, {
    resolveMediaUrl,
    editionRuns: editionRuns.recorder,
    originalPrints: editionRuns.originalPrintsRecorder,
    releaseAlerts: shopAlerts.announcer,
    offers: originalOffers,
  });
  const artistCatalogue = createDrizzleArtistCatalogueWriter(shopUow);
  const originalMoveReader = createDrizzleOriginalMoveReader(db);
  const artworkRegister = new DrizzleArtworkRegisterRepository(db);
  const inventoryMoves = new OriginalMoveService({
    originals: originalMoveReader,
    register: artworkRegister,
    history: artworkRegister,
    auction: createHttpAuctionOfferGateway(env),
    withdrawFromLaxArt: async ({ artworkId, actorSubjectId }) => {
      await artworkCatalogue.setVisibility({
        artworkId,
        action: "unpublish",
        actorSubjectId,
        idempotencyKey: randomUUID(),
      });
    },
    resolveImageUrl: resolveMediaUrl,
  });
  const reopenArtListing = new ReopenArtListingService({
    originals: originalMoveReader,
    register: artworkRegister,
    restoreListing: async ({ artworkId, actor }) => {
      await artworkCatalogue.setVisibility({
        artworkId,
        action: "restore",
        actorSubjectId: actor,
        idempotencyKey: randomUUID(),
      });
    },
  });
  const homeFeatures = createHomeFeaturesService({
    uow: createDrizzleHomeFeaturesUnitOfWork(shopUow, { resolveMediaUrl }),
    lists: createDrizzleHomeFeatureListReader(db, { resolveMediaUrl }),
    clock: { now: () => new Date() },
  });
  const artCache =
    env.ART_REVALIDATE_URL && env.ART_REVALIDATE_SECRET
      ? createHttpArtCacheInvalidator({
          url: env.ART_REVALIDATE_URL,
          secret: env.ART_REVALIDATE_SECRET,
        })
      : noopArtCacheInvalidator;
  const adjustMerchandiseStock = createAdjustMerchandiseStockHandler({ merchandiseStock });
  const createMerchandiseProduct = createCreateMerchandiseProductHandler({ merchandiseStock });
  const invoiceGateway = createStripeShopInvoiceGateway({ secretKey: env.STRIPE_SECRET_KEY });
  const connectPlatformKey = env.STRIPE_SHOP_CONNECT_PLATFORM_KEY;
  const connectGateway = env.STRIPE_SECRET_KEY
    ? createStripeShopConnectGateway({
        secretKey: env.STRIPE_SECRET_KEY,
        platformKey: connectPlatformKey,
      })
    : null;
  const payeeConnectAccounts = createDrizzleShopPayeeConnectAccountRepository(
    db,
    connectPlatformKey,
  );
  const payeeConnect = createDrizzleShopPayeeConnectService({
    db,
    accounts: payeeConnectAccounts,
    gateway: connectGateway,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
    storefrontOrigins,
    failClosedConnectUrls: env.NODE_ENV === "production",
  });
  const syncConnectAccount = connectGateway
    ? createSyncConnectAccountHandler({ gateway: connectGateway, accounts: payeeConnectAccounts })
    : async () => "ignored" as const;
  const originalSaleWriterFor = (writerDb: Database) =>
    createDrizzleOriginalSaleWriter({
      db: writerDb,
      uow: shopUow,
      invoiceGateway,
      domainEventMode: env.DOMAIN_EVENT_PUBLISH_VALIDATE,
      offers: originalOffers,
    });
  const originalSales = originalSaleWriterFor(db);
  const adminOriginalSales = {
    ...originalSales,
    createReservation: idempotentAdminCommand(
      { uow: shopUow },
      {
        commandType: "original_sale.create",
        run: (tx, command: CreateOriginalSaleCommand) =>
          originalSaleWriterFor(tx).createReservation(command),
      },
    ),
  };
  const healthDeps = {
    checkConnectivity: () => readiness.checkConnectivity(),
    checkCatalogueSchema: () => readiness.checkCatalogueSchema(),
  };
  const shopMediaAssets = createDrizzleShopMediaAssetRepository(db);
  const shopMediaUpload = shopMediaStorage
    ? createShopMediaUploadHandlers({
        storage: shopMediaStorage.storage,
        repository: shopMediaAssets,
        imageProbe: createSharpImageProbe(),
      })
    : null;
  const artistApplications = createArtistApplicationServices({
    db,
    uow: shopUow,
    resolveMediaUrl,
    mediaUploads: shopMediaUpload,
    mediaAssets: shopMediaAssets,
    staffReader,
    rateLimitCounter,
    artPublicUrl: env.LAX_ART_PUBLIC_URL ?? env.SHOP_STOREFRONT_URL,
    onRateLimitUnavailable: (error) =>
      console.warn("artist_application_rate_limit_unavailable", {
        reason: error instanceof Error ? error.name : "unknown",
      }),
  });
  const previewSecret =
    env.SHOP_EDITORIAL_PREVIEW_SECRET ??
    (env.NODE_ENV !== "production" ? env.SHOP_API_BFF_TOKEN : undefined);
  const editorial: EditorialRoutesDeps | null =
    env.SHOP_EDITORIAL_ENABLED && previewSecret
      ? {
          editorial: createDrizzleEditorialRepository(db, {
            resolveMediaUrl,
            enquiryFollowUp,
            ...(env.SHOP_ENQUIRY_NOTIFICATION_EMAIL
              ? {
                  generalEnquiryAlerts: {
                    notifications,
                    opsEmail: env.SHOP_ENQUIRY_NOTIFICATION_EMAIL,
                  },
                }
              : {}),
          }),
          links: createEditorialLinksService(
            createDrizzleEditorialLinksRepository(db, { resolveMediaUrl }),
          ),
          help: createDrizzleHelpRepository(db, { resolveMediaUrl }),
          search: createDrizzleEditorialSearchReader(db, { resolveMediaUrl }),
          previewSecret,
          enquiryRateLimiter,
          artCache,
        }
      : null;
  return {
    db,
    app: {
      env,
      auth: {
        jwksUrl,
        issuer: env.OIDC_ISSUER_URL,
        bffToken: env.SHOP_API_BFF_TOKEN,
      },
      commerce: {
        ...commerce,
        orderProblems: {
          writer: createDrizzleOrderProblemReportWriter(db, {
            notifications,
            opsEmail: env.SHOP_ENQUIRY_NOTIFICATION_EMAIL ?? env.SHOP_OPS_ALERT_EMAIL ?? null,
          }),
          rateLimiter: enquiryRateLimiter,
        },
      },
      stripeWebhook,
      health: healthDeps,
      staffReader,
      admin: {
        featureFlags: createShopFeatureFlagsReader(env),
        stepUpMaxAuthAgeSeconds: env.SHOP_ADMIN_FINANCE_MAX_AUTH_AGE_SECONDS,
        health: healthDeps,
        importArtwork: adminImportArtwork,
        grantSaleAuthority: adminGrantSaleAuthority,
        getSaleAuthorityRequest: (requestId) =>
          adminRead.saleAuthorityRequests.getRequestById(requestId),
        rejectSaleAuthorityRequest,
        adminRead,
        artistApplicationReview: artistApplications.review,
        enquiryInbox: createEnquiryInboxService({
          repository: createDrizzleEnquiryInboxRepository(db, { resolveMediaUrl }),
          staffReader,
        }),
        leads: new LeadsService(createDrizzleLeadReader(db)),
        artworkRegister: new ArtworkRegisterReviewService({
          queue: new DrizzleArtworkRegisterQueueReader(db),
          register: artworkRegisterRepository,
          resolver: artworkRegisterRepository,
          runs: new DrizzleZohoArtworkSyncStore(db),
          listingRuns: new DrizzleZohoListingRunStore(db),
          staffNames: createDrizzleStaffNameReader(db),
          listings: laxArtListings,
        }),
        offerOnLaxArt: new OfferOnLaxArtService({
          register: artworkRegisterRepository,
          artists: createDrizzleLaxArtArtistDirectory(db),
          listings: laxArtListings,
          drafts: createDrizzleLaxArtDraftWriter(shopUow, {
            registerFor: (session) => artworkRegisterRepository.withExecutor(session),
            listings: laxArtListings,
          }),
        }),
        releaseAlertSummary: shopAlerts.summary,
        guestErasure: new GuestErasureService(
          createDrizzleGuestErasureStore(db, {
            domainEventMode: env.DOMAIN_EVENT_PUBLISH_VALIDATE,
          }),
        ),
        productionTasks: createProductionTaskService({
          repository: createDrizzleProductionTaskRepository(db),
          staffReader,
        }),
        savedViews: createSavedViewService({ repository: createDrizzleSavedViewRepository(db) }),
        staffReader,
        createProductionTask,
        updateFulfilment,
        recordPossession,
        cancelAfterPossession,
        requestRefund,
        retryRefund,
        markRefundSettledOutside,
        advanceReturn,
        markPayoutPaid,
        saleFees,
        stockHolds,
        createStockHold,
        adjustMerchandiseStock,
        createMerchandiseProduct,
        merchandiseCatalogue,
        artworkCatalogue,
        inventoryMoves,
        editionRuns,
        artistCatalogue,
        artCache,
        homeFeatures,
        thirdPartySales,
        originalSales: adminOriginalSales,
        linkArtistIdentity,
        unlinkArtistIdentity,
        updateArtistSeo: (artistId, fields) => artistSeoWriter.updateArtistSeo(artistId, fields),
        shopMediaUpload,
      },
      portal: {
        portalOwnership,
        portalSales,
        portalArtist,
        portalFavorites,
        laxPortfolio,
        artistApplications: artistApplications.applicant,
      },
      identityDeletion: {
        eligibility: createShopDeletionEligibilityService({
          reader: createDrizzleDeletionEligibilityRepository(db),
          origins: storefrontOrigins,
        }),
        machine: {
          clientId: env.IDENTITY_MACHINE_CLIENT_ID,
          clientSecret: env.IDENTITY_MACHINE_CLIENT_SECRET,
        },
      },
      inventory: {
        reopen: reopenArtListing,
        lookup: createDrizzleArtListingLookup(db),
        machine: {
          clientId: env.INVENTORY_MACHINE_CLIENT_ID,
          clientSecret: env.INVENTORY_MACHINE_CLIENT_SECRET,
        },
      },
      identitySubjectExport: {
        exports: new SubjectExportService(
          createShopSubjectExportRegistry({
            db,
            origins: storefrontOrigins,
            files: new SubjectExportFileSigner(
              shopMediaStorage?.storage ?? unconfiguredSubjectExportStorage,
            ),
          }),
        ),
        machine: {
          clientId: env.IDENTITY_SUBJECT_EXPORT_CLIENT_ID,
          clientSecret: env.IDENTITY_SUBJECT_EXPORT_CLIENT_SECRET,
        },
      },
      payeeConnect,
      stripeConnectWebhook: {
        webhookSecret: env.STRIPE_SHOP_CONNECT_WEBHOOK_SECRET,
        verifyWebhook: constructStripeWebhookEvent,
        syncAccount: syncConnectAccount,
      },
      catalogue: {
        listPublicArtworks: createListPublicArtworksHandler(catalogueReader),
        getPublicArtwork: createGetPublicArtworkHandler(catalogueReader),
        listArtworkObjectTypeFacets: createListArtworkObjectTypeFacetsHandler(catalogueReader),
        countArtworkFacets: createCountArtworkFacetsHandler(catalogueReader),
        listPublicCategories: createListPublicCategoriesHandler(categoryReader),
        getPublicCategory: createGetPublicCategoryHandler(categoryReader),
        listPublicArtists: createListPublicArtistsHandler(artistReader),
        getPublicArtist: createGetPublicArtistHandler(artistReader),
      },
      merchandise: {
        listPublicMerchandiseProducts:
          createListPublicMerchandiseProductsHandler(merchandiseReader),
        getPublicMerchandiseProduct: createGetPublicMerchandiseProductHandler(merchandiseReader),
      },
      artistApplicant: artistApplications.applicant,
      interest: {
        registerArtworkInterest: createRegisterArtworkInterestHandler(artworkInterestWriter),
        getArtworkInterest: createGetArtworkInterestHandler(artworkInterestWriter),
        enquiryRateLimiter,
        editionAlerts,
        editionAlertRateLimiter,
        releaseAlerts,
        releaseAlertRateLimiter,
      },
      editorial,
    },
    importArtwork,
    grantStaffRole: async (input) => {
      await grantShopStaffRole(db, input);
    },
    grantSaleAuthority: (command) => saleAuthorityWriter.grantSaleAuthority(command),
    async seedCatalogue(): Promise<void> {
      await seedShopFoundationCatalogue(importArtwork, db, (command) =>
        saleAuthorityWriter.grantSaleAuthority(command),
      );
      await seedShopStorefrontCuration(db, createDrizzleStorefrontCurationWriter);
    },
    async seedAcceptancePortal(identitySubjectId: string, displayName?: string): Promise<void> {
      await seedAcceptancePortalFixtures(
        db,
        (command) => saleAuthorityWriter.grantSaleAuthority(command),
        {
          identitySubjectId,
          ...(displayName ? { displayName } : {}),
        },
      );
    },
    async queueFinanceOpsAlert(input: {
      idempotencyKey: string;
      action: string;
      orderId: string;
      detail: string;
      operator: string;
      reason: string;
      host: string;
    }): Promise<void> {
      const opsEmail = env.SHOP_OPS_ALERT_EMAIL ?? env.SHOP_ENQUIRY_NOTIFICATION_EMAIL ?? null;
      if (!opsEmail?.includes("@")) {
        return;
      }
      await notifications.queueCheckoutOpsAlert(db, {
        idempotencyKey: input.idempotencyKey,
        opsEmail,
        alertKind: `Shop ops: ${input.action}`,
        orderId: input.orderId,
        detail: `${input.detail}\n\nOperator: ${input.operator}\nReason: ${input.reason}\nHost: ${input.host}`,
      });
    },
    async reportPhase2BackfillDryRun(): Promise<unknown[]> {
      const result = await db.execute(sql`
        SELECT o.id AS order_id, o.status, o.paid_at,
          (SELECT COUNT(*)::int FROM shop_payout_ledger p
            JOIN shop_order_line l ON l.id = p.order_line_id WHERE l.order_id = o.id) AS payout_rows,
          (SELECT COUNT(*)::int FROM shop_fulfilment f WHERE f.order_id = o.id) AS fulfilment_rows
        FROM shop_order o
        WHERE o.status = 'paid'
        ORDER BY o.paid_at ASC NULLS LAST
        LIMIT 500
      `);
      return result.rows as unknown[];
    },
    async close() {
      await rateLimitRedis?.quit();
      await closeDb(db);
    },
  };
}
