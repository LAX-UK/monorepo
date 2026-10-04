import { type Database, closeDb, createDb } from "@auction/db";
import { sql } from "drizzle-orm";
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
  createDrizzleOriginalSaleWriter,
  createDrizzleSaleFeeWriter,
  createDrizzleStockHoldWriter,
  createDrizzleThirdPartySaleWriter,
} from "./infrastructure/drizzle-shop-phase-writers.js";
import { createDrizzleShopReadinessAdapter } from "./infrastructure/drizzle-shop-readiness.adapter.js";
import { createDrizzleShopStaffMemberReader } from "./infrastructure/drizzle-shop-staff-member.reader.js";
import { createDrizzleShopUnitOfWork } from "./infrastructure/drizzle-shop-transaction-effects.js";
import { createDrizzleStorefrontCurationWriter } from "./infrastructure/drizzle-storefront-curation.repository.js";
import { grantShopStaffRole } from "./infrastructure/grant-staff-role.js";
import { createCancelAfterPossessionHandler } from "./infrastructure/handlers/admin/cancel-after-possession.handler.js";
import { createCreateProductionTaskHandler } from "./infrastructure/handlers/admin/create-production-task.handler.js";
import { createCreateStockHoldHandler } from "./infrastructure/handlers/admin/create-stock-hold.handler.js";
import { createMarkPayoutPaidHandler } from "./infrastructure/handlers/admin/mark-payout-paid.handler.js";
import { createRecordPossessionHandler } from "./infrastructure/handlers/admin/record-possession.handler.js";
import { createRequestRefundHandler } from "./infrastructure/handlers/admin/request-refund.handler.js";
import { createUpdateFulfilmentHandler } from "./infrastructure/handlers/admin/update-fulfilment.handler.js";
import { seedAcceptancePortalFixtures } from "./infrastructure/seed/acceptance-portal-seed.js";
import { seedShopFoundationCatalogue } from "./infrastructure/seed/catalogue-seed.js";
import { seedShopStorefrontCuration } from "./infrastructure/seed/storefront-curation-seed.js";
import { loadShopCancellationPolicy } from "./infrastructure/shop-cancellation-policy.js";
import { createShopFeatureFlagsReader } from "./infrastructure/shop-feature-flags-env.js";
import { assertShopVatPolicyWhenPayoutsEnabled } from "./infrastructure/shop-vat-policy.js";
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
  grantStaffRole(input: {
    subject: string;
    role: import("@auction/shop-domain").ShopStaffRole;
    operatorSubjectId: string;
  }): Promise<void>;
  grantSaleAuthority: AdminRoutesDeps["grantSaleAuthority"];
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

export function createShopApiContainer(env: ShopApiEnv): ShopApiContainer {
  assertShopVatPolicyWhenPayoutsEnabled(env);
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
  const shopUow = createDrizzleShopUnitOfWork(db, env.DOMAIN_EVENT_PUBLISH_VALIDATE);
  const cancellationPolicy = loadShopCancellationPolicy(env);
  const createProductionTask = createCreateProductionTaskHandler({ uow: shopUow });
  const requestRefund = createRequestRefundHandler({ uow: shopUow });
  const markPayoutPaid = createMarkPayoutPaidHandler({ uow: shopUow });
  const updateFulfilment = createUpdateFulfilmentHandler({ uow: shopUow });
  const recordPossession = createRecordPossessionHandler({
    uow: shopUow,
    policy: cancellationPolicy,
  });
  const cancelAfterPossession = createCancelAfterPossessionHandler({ uow: shopUow });
  const stockHolds = createDrizzleStockHoldWriter(db, env.DOMAIN_EVENT_PUBLISH_VALIDATE);
  const createStockHold = createCreateStockHoldHandler({ stockHolds, staffReader });
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
        featureFlags: createShopFeatureFlagsReader(env),
        financeMaxAuthAgeSeconds: env.SHOP_ADMIN_FINANCE_MAX_AUTH_AGE_SECONDS,
        health: healthDeps,
        importArtwork,
        grantSaleAuthority: (command) => saleAuthorityWriter.grantSaleAuthority(command),
        staffReader,
        createProductionTask,
        updateFulfilment,
        recordPossession,
        cancelAfterPossession,
        requestRefund,
        markPayoutPaid,
        saleFees: createDrizzleSaleFeeWriter(db),
        stockHolds,
        createStockHold,
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
    grantStaffRole: (input) => grantShopStaffRole(db, input),
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
    close: () => closeDb(db),
  };
}
