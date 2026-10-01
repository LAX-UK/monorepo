import { type Database, closeDb, createDb } from "@auction/db";
import type { AdminRoutesDeps } from "./admin-route-deps.js";
import { createGetArtworkInterestHandler } from "./application/handlers/get-artwork-interest.handler.js";
import { createGetPublicArtistHandler } from "./application/handlers/get-public-artist.handler.js";
import { createGetPublicArtworkHandler } from "./application/handlers/get-public-artwork.handler.js";
import { createGetPublicCategoryHandler } from "./application/handlers/get-public-category.handler.js";
import { createImportArtworkHandler } from "./application/handlers/import-artwork.handler.js";
import { createListPublicArtistsHandler } from "./application/handlers/list-public-artists.handler.js";
import { createListPublicArtworksHandler } from "./application/handlers/list-public-artworks.handler.js";
import { createListPublicCategoriesHandler } from "./application/handlers/list-public-categories.handler.js";
import { createRegisterArtworkInterestHandler } from "./application/handlers/register-artwork-interest.handler.js";
import type { CatalogueRoutesDeps } from "./catalogue-route-deps.js";
import type { CommerceRoutesDeps, StripeWebhookDeps } from "./commerce-route-deps.js";
import { createCommerceServices } from "./create-commerce-services.js";
import type { ShopApiEnv } from "./env.js";
import { createDrizzleArtistDirectoryRepository } from "./infrastructure/drizzle-artist-directory.repository.js";
import { createDrizzleArtworkCatalogueRepository } from "./infrastructure/drizzle-artwork-catalogue.repository.js";
import { createDrizzleArtworkImportRepository } from "./infrastructure/drizzle-artwork-import.repository.js";
import { createDrizzleArtworkInterestRepository } from "./infrastructure/drizzle-artwork-interest.repository.js";
import { createDrizzleCategoryCatalogueRepository } from "./infrastructure/drizzle-category-catalogue.repository.js";
import { createDrizzlePortalOwnershipRepository } from "./infrastructure/drizzle-portal-ownership.repository.js";
import { createDrizzleSaleAuthorityWriter } from "./infrastructure/drizzle-sale-authority.writer.js";
import { createDrizzleShopNotificationPublisher } from "./infrastructure/drizzle-shop-notification.publisher.js";
import {
  createDrizzleFulfilmentWriter,
  createDrizzleOriginalSaleWriter,
  createDrizzlePayoutWriter,
  createDrizzleProductionWriter,
  createDrizzleRefundWriter,
  createDrizzleSaleFeeWriter,
  createDrizzleStockHoldWriter,
  createDrizzleThirdPartySaleWriter,
} from "./infrastructure/drizzle-shop-phase-writers.js";
import { createDrizzleShopReadinessAdapter } from "./infrastructure/drizzle-shop-readiness.adapter.js";
import { createDrizzleShopStaffMemberReader } from "./infrastructure/drizzle-shop-staff-member.reader.js";
import { createDrizzleStorefrontCurationWriter } from "./infrastructure/drizzle-storefront-curation.repository.js";
import { seedShopFoundationCatalogue } from "./infrastructure/seed/catalogue-seed.js";
import { seedShopStorefrontCuration } from "./infrastructure/seed/storefront-curation-seed.js";
import { loadShopCancellationPolicy } from "./infrastructure/shop-cancellation-policy.js";
import type { InterestRoutesDeps } from "./interest-route-deps.js";
import type { PortalRoutesDeps } from "./portal-route-deps.js";

export type ShopApiAppDeps = {
  env: ShopApiEnv;
  health: {
    checkConnectivity(): Promise<void>;
    checkCatalogueSchema(): Promise<void>;
  };
  catalogue: CatalogueRoutesDeps;
  interest: InterestRoutesDeps;
  commerce: CommerceRoutesDeps;
  stripeWebhook: StripeWebhookDeps;
  auth: {
    jwksUrl: string;
    issuer: string;
    bffToken?: string | undefined;
  };
  admin: AdminRoutesDeps;
  portal: PortalRoutesDeps;
  staffReader: AdminRoutesDeps["staffReader"];
};

export type ShopApiContainer = {
  db: Database;
  app: ShopApiAppDeps;
  importArtwork: ReturnType<typeof createImportArtworkHandler>;
  seedCatalogue(): Promise<void>;
  close(): Promise<void>;
};

export function createShopApiContainer(env: ShopApiEnv): ShopApiContainer {
  const db: Database = createDb(env.DATABASE_URL_SHOP);
  const notifications = createDrizzleShopNotificationPublisher();
  const catalogueReader = createDrizzleArtworkCatalogueRepository(db);
  const categoryReader = createDrizzleCategoryCatalogueRepository(db);
  const artistReader = createDrizzleArtistDirectoryRepository(db);
  const artworkImportWriter = createDrizzleArtworkImportRepository(
    db,
    env.DOMAIN_EVENT_PUBLISH_VALIDATE,
  );
  const importArtwork = createImportArtworkHandler(artworkImportWriter);
  const { commerce, stripeWebhook } = createCommerceServices(db, env);
  const readiness = createDrizzleShopReadinessAdapter(db);
  const artworkInterestWriter = createDrizzleArtworkInterestRepository(db, {
    notifications,
    domainEventMode: env.DOMAIN_EVENT_PUBLISH_VALIDATE,
    ...(env.SHOP_ENQUIRY_NOTIFICATION_EMAIL
      ? { enquiryOpsEmail: env.SHOP_ENQUIRY_NOTIFICATION_EMAIL }
      : {}),
  });
  const internalBase = env.OIDC_INTERNAL_BASE_URL ?? env.OIDC_ISSUER_URL;
  const jwksUrl = `${internalBase.replace(/\/+$/, "")}/.well-known/jwks.json`;
  const staffReader = createDrizzleShopStaffMemberReader(db);
  const saleAuthorityWriter = createDrizzleSaleAuthorityWriter(
    db,
    env.DOMAIN_EVENT_PUBLISH_VALIDATE,
  );
  const portalOwnership = createDrizzlePortalOwnershipRepository(db);
  const healthDeps = {
    checkConnectivity: () => readiness.checkConnectivity(),
    checkCatalogueSchema: () => readiness.checkCatalogueSchema(),
  };
  return {
    db,
    app: {
      env,
      auth: {
        jwksUrl,
        issuer: env.OIDC_ISSUER_URL,
        bffToken: env.SHOP_API_BFF_TOKEN,
      },
      commerce,
      stripeWebhook,
      health: healthDeps,
      staffReader,
      admin: {
        financeMaxAuthAgeSeconds: env.SHOP_ADMIN_FINANCE_MAX_AUTH_AGE_SECONDS,
        health: healthDeps,
        importArtwork,
        grantSaleAuthority: (command) => saleAuthorityWriter.grantSaleAuthority(command),
        staffReader,
        production: createDrizzleProductionWriter(db),
        fulfilment: createDrizzleFulfilmentWriter(db, loadShopCancellationPolicy(env)),
        refunds: createDrizzleRefundWriter(db),
        payouts: createDrizzlePayoutWriter(db),
        saleFees: createDrizzleSaleFeeWriter(db),
        stockHolds: createDrizzleStockHoldWriter(db),
        thirdPartySales: createDrizzleThirdPartySaleWriter(db),
        originalSales: createDrizzleOriginalSaleWriter(db),
      },
      portal: { portalOwnership },
      catalogue: {
        listPublicArtworks: createListPublicArtworksHandler(catalogueReader),
        getPublicArtwork: createGetPublicArtworkHandler(catalogueReader),
        listPublicCategories: createListPublicCategoriesHandler(categoryReader),
        getPublicCategory: createGetPublicCategoryHandler(categoryReader),
        listPublicArtists: createListPublicArtistsHandler(artistReader),
        getPublicArtist: createGetPublicArtistHandler(artistReader),
      },
      interest: {
        registerArtworkInterest: createRegisterArtworkInterestHandler(artworkInterestWriter),
        getArtworkInterest: createGetArtworkInterestHandler(artworkInterestWriter),
      },
    },
    importArtwork,
    async seedCatalogue(): Promise<void> {
      await seedShopFoundationCatalogue(importArtwork, db, (command) =>
        saleAuthorityWriter.grantSaleAuthority(command),
      );
      await seedShopStorefrontCuration(db, createDrizzleStorefrontCurationWriter);
    },
    close: () => closeDb(db),
  };
}
