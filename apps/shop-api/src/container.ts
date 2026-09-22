import { type Database, closeDb, createDb } from "@auction/db";
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
import { createDrizzleShopNotificationPublisher } from "./infrastructure/drizzle-shop-notification.publisher.js";
import { createDrizzleShopReadinessAdapter } from "./infrastructure/drizzle-shop-readiness.adapter.js";
import { createDrizzleStorefrontCurationWriter } from "./infrastructure/drizzle-storefront-curation.repository.js";
import { seedShopFoundationCatalogue } from "./infrastructure/seed/catalogue-seed.js";
import { seedShopStorefrontCuration } from "./infrastructure/seed/storefront-curation-seed.js";
import type { InterestRoutesDeps } from "./interest-route-deps.js";

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
  const artworkImportWriter = createDrizzleArtworkImportRepository(db);
  const importArtwork = createImportArtworkHandler(artworkImportWriter);
  const { commerce, stripeWebhook } = createCommerceServices(db, env);
  const readiness = createDrizzleShopReadinessAdapter(db);
  const artworkInterestWriter = createDrizzleArtworkInterestRepository(db, {
    notifications,
    ...(env.SHOP_ENQUIRY_NOTIFICATION_EMAIL
      ? { enquiryOpsEmail: env.SHOP_ENQUIRY_NOTIFICATION_EMAIL }
      : {}),
  });
  const internalBase = env.OIDC_INTERNAL_BASE_URL ?? env.OIDC_ISSUER_URL;
  const jwksUrl = `${internalBase.replace(/\/+$/, "")}/.well-known/jwks.json`;
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
      health: {
        checkConnectivity: () => readiness.checkConnectivity(),
        checkCatalogueSchema: () => readiness.checkCatalogueSchema(),
      },
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
      await seedShopFoundationCatalogue(importArtwork, db);
      await seedShopStorefrontCuration(db, createDrizzleStorefrontCurationWriter);
    },
    close: () => closeDb(db),
  };
}
