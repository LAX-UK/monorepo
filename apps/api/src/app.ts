import {
  runSignInTurnstileGate,
  stampLastPasswordAuthFromSignInResponse,
} from "@auction/auth/server";
import { lotNotDeleted } from "@auction/db";
import { lot } from "@auction/db/schema";
import { BROWSER_API_CUSTOM_HEADERS } from "@auction/http-headers";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import type { Container } from "./container.js";
import type { Env } from "./env.js";
import { assertBullBoardProductionSafety, mountBullBoard } from "./lib/bull-board.js";
import { createAppLogger } from "./lib/logger.js";
import { connectionOptionsFromRedisUrl } from "./lib/redis-url.js";
import { trustedWebOrigins } from "./lib/trusted-origins.js";
import { createAuditAccessMiddleware } from "./middleware/audit-access.js";
import { createAuthNoStoreMiddleware } from "./middleware/auth-cache-control.js";
import {
  createAuthRateLimitMiddleware,
  createMagicLinkRateLimitMiddleware,
  createRegisterRateLimitMiddleware,
  createSendVerificationRateLimitMiddleware,
} from "./middleware/auth-rate-limit.js";
import { createMarketingClientContextMiddleware } from "./middleware/marketing-client-context.js";
import { createMarketingConsentMiddleware } from "./middleware/marketing-consent.js";
import { createMetricsMiddleware, renderMetrics } from "./middleware/metrics.js";
import { createOrganizationCreateRateLimitMiddleware } from "./middleware/organization-rate-limit.js";
import { createPublicCacheControlMiddleware } from "./middleware/public-cache-control.js";
import { createRateLimitMiddleware } from "./middleware/rate-limit.js";
import { createRequestIdMiddleware } from "./middleware/request-id.js";
import { createRequireAuth } from "./middleware/require-auth.js";
import { requirePlatformShell } from "./middleware/require-capability.js";
import { requireSuperAdminStaffRole } from "./middleware/require-staff-role.js";
import { createSecurityHeadersMiddleware } from "./middleware/security-headers.js";
import { createVerifyOriginMiddleware } from "./middleware/verify-origin.js";
import { createPublicInvitationRoutes } from "./routes/admin-invitations.js";
import { createAdminRoutes } from "./routes/admin.js";
import { createArtistRoutes } from "./routes/artists.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createBidRoutes } from "./routes/bids.js";
import { createCategoryRoutes } from "./routes/categories.js";
import { createEmailRoutes } from "./routes/email.js";
import { createExportRoutes } from "./routes/exports.js";
import { createInternalCronRoutes } from "./routes/internal-cron.js";
import { createKycRoutes } from "./routes/kyc.js";
import { createActingContextUserRoutes, createLegalEntityRoutes } from "./routes/legal-entities.js";
import { createLegalEntityMemberRoutes } from "./routes/legal-entity-members.js";
import { createLotDocumentRoutes } from "./routes/lot-documents.js";
import { createLotRoutes } from "./routes/lots.js";
import { createMarketingRoutes } from "./routes/marketing.js";
import { createNewsletterRoutes } from "./routes/newsletter.js";
import { createOnsiteEventRoutes } from "./routes/onsite-events.js";
import { createOrganizationRoutes } from "./routes/organizations.js";
import { createPaymentRoutes } from "./routes/payments.js";
import { createLegalEntityPayoutStatementRoutes } from "./routes/payout-statements.js";
import { createAdminPayoutRoutes, createPayoutRoutes } from "./routes/payouts.js";
import { createPressRoutes } from "./routes/press.js";
import { createQrRoutes } from "./routes/qr.js";
import { createSaleDocumentRoutes } from "./routes/sale-documents.js";
import { createSaleroomDisplayRoutes } from "./routes/saleroom-display.js";
import { createSaleRoutes } from "./routes/sales.js";
import { createStripeConnectRoutes } from "./routes/stripe-connect.js";
import { createSubmissionDocumentRoutes } from "./routes/submission-documents.js";
import { createSubmissionRoutes } from "./routes/submissions.js";
import { createTelephoneBookingRoutes } from "./routes/telephone-bookings/index.js";
import { createUploadRoutes } from "./routes/uploads.js";
import { createUserRoutes } from "./routes/users.js";
import { createVenueRoutes } from "./routes/venues.js";
import { createWebhookRoutes } from "./routes/webhooks/index.js";
import { createStripeWebhookRoutes } from "./routes/webhooks/stripe.js";
import { createVeriffWebhookRoutes } from "./routes/webhooks/veriff.js";
import { createWellKnownRoutes } from "./routes/well-known.js";
import { createXeroWebhookRoutes } from "./routes/xero-webhook.js";
import type { IAuthenticator } from "./services/interfaces/authenticator.js";

/** Browser CORS allowlist — sourced from `@auction/http-headers`. */
export const BROWSER_CORS_ALLOW_HEADERS = BROWSER_API_CUSTOM_HEADERS;

export function createApp(container: Container, env: Env, authenticator: IAuthenticator) {
  const webOrigins = trustedWebOrigins(env);
  const app = new Hono();
  app.onError((err, c) => container.httpErrorHandler.handle(err, c));
  const appLogger = createAppLogger(env);
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  /** Process is listening; no DB/Redis (used by container health checks during boot). */
  app.get("/health/live", (c) => c.json({ status: "ok" }));

  app.get("/health/email", (c) =>
    c.json({
      provider: env.EMAIL_PROVIDER === "postmark" ? "postmark" : "console",
    }),
  );

  app.use("*", createRequestIdMiddleware());
  app.use("*", createSecurityHeadersMiddleware());
  app.use("*", createMetricsMiddleware());
  app.use("*", createMarketingConsentMiddleware());
  app.use("*", createMarketingClientContextMiddleware());
  app.use(
    "/.well-known/*",
    cors({
      origin: "*",
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Length"],
      maxAge: 60,
    }),
  );
  app.route("/.well-known", createWellKnownRoutes(container, env));
  app.use(
    "*",
    cors({
      origin: webOrigins,
      allowHeaders: [...BROWSER_CORS_ALLOW_HEADERS],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }),
  );
  app.use("*", createVerifyOriginMiddleware(webOrigins, env.VERIFY_ORIGIN));

  app.use("/api/auth/*", createAuthNoStoreMiddleware());
  app.use("/auth/*", createAuthNoStoreMiddleware());

  app.use("/lots/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/display/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/sales/*", createRateLimitMiddleware(container.rateLimitStore));
  const publicCatalogueCache = createPublicCacheControlMiddleware({
    sMaxAge: 30,
    staleWhileRevalidate: 60,
  });
  app.use("/lots", etag(), compress(), publicCatalogueCache);
  app.use("/lots/*", etag(), compress(), publicCatalogueCache);
  app.use("/sales", etag(), compress(), publicCatalogueCache);
  app.use("/sales/*", etag(), compress(), publicCatalogueCache);
  app.use("/press", etag(), compress(), publicCatalogueCache);
  app.use("/press/*", etag(), compress(), publicCatalogueCache);
  app.use("/bids/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/users/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/auth/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/payments/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/q/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/categories/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/venues/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/submissions/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/uploads/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/admin/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/legal-entities/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/kyc/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/organizations/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/artists/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/events/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/stripe-connect/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/payouts/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/webhooks/postmark", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/webhooks/postmark/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/webhooks/shopify", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/webhooks/shopify/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/webhooks/wordpress", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/webhooks/wordpress/*", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/webhooks/xero", createRateLimitMiddleware(container.rateLimitStore));
  app.use("/webhooks/xero/*", createRateLimitMiddleware(container.rateLimitStore));

  app.get("/health/ready", async (c) => {
    try {
      await container.db.execute(sql`select 1`);
      await container.redis.ping();
      return c.json({ status: "ok", database: "ok", redis: "ok" });
    } catch (e) {
      appLogger.error({ err: String(e) }, "health_check_failed");
      return c.json({ status: "degraded" }, 503);
    }
  });

  /** Backwards-compatible readiness alias for older deploy health checks. */
  app.get("/health", (c) => c.redirect("/health/ready", 307));

  app.get("/system/health/upload-validation", async (c) => {
    try {
      const workers = await container.uploadValidationQueue.getWorkers();
      const count = workers.length;
      return c.json({ ok: count > 0, workers: count });
    } catch {
      return c.json({ ok: false, workers: 0 });
    }
  });

  app.get("/metrics", requireAuth, requirePlatformShell, async (c) => {
    const [activeRow] = await container.db
      .select({ n: sql<number>`count(*)::int` })
      .from(lot)
      .where(and(eq(lot.status, "active"), lotNotDeleted()));
    const activeLots = activeRow?.n ?? 0;
    return c.text(`${await renderMetrics()}auction_api_active_lots ${activeLots}\n`, 200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    });
  });

  app.use("/api/auth/*", createAuthRateLimitMiddleware(container.redis));
  app.use("/api/auth/*", createMagicLinkRateLimitMiddleware(container.redis));
  app.use("/api/auth/*", createSendVerificationRateLimitMiddleware(container.redis));
  app.use("/users/register", createRegisterRateLimitMiddleware(container.redis));
  app.all("/api/auth/*", async (c) => {
    return runSignInTurnstileGate({
      incoming: c.req.raw,
      redis: container.redis,
      turnstileSecret: env.TURNSTILE_SECRET_KEY,
      authHandler: (req: Request) => container.auth.handler(req),
      onEmailPasswordSignInSuccess: (res: Response) =>
        stampLastPasswordAuthFromSignInResponse(container.authDb, res),
    });
  });

  const routed = app
    .route("/internal/jobs", createInternalCronRoutes(container, env))
    .route("/invitations", createPublicInvitationRoutes(container.admin.invitations))
    .route("/lots", createLotRoutes(container, authenticator))
    .route("/lots", createLotDocumentRoutes(container, authenticator))
    .route("/events", createOnsiteEventRoutes(container))
    .route("/", createTelephoneBookingRoutes(container, authenticator))
    .route("/sales", createSaleRoutes(container, authenticator))
    .route("/press", createPressRoutes(container, authenticator))
    .route("/", createSaleroomDisplayRoutes(container))
    .route("/sales", createSaleDocumentRoutes(container, authenticator))
    .route("/bids", createBidRoutes(container, authenticator))
    .route("/users", createUserRoutes(container, authenticator))
    .route("/users", createActingContextUserRoutes(container, authenticator))
    .route("/legal-entities", createLegalEntityPayoutStatementRoutes(container, authenticator))
    .route("/legal-entities", createLegalEntityMemberRoutes(container, authenticator))
    .route("/legal-entities", createLegalEntityRoutes(container, authenticator))
    .route("/kyc", createKycRoutes(container, authenticator))
    .route(
      "/organizations",
      createOrganizationRoutes(
        container,
        authenticator,
        createOrganizationCreateRateLimitMiddleware(container.redis),
      ),
    )
    .route("/artists", createArtistRoutes(container, authenticator))
    .route("/stripe-connect", createStripeConnectRoutes(container, authenticator))
    .route("/payouts", createPayoutRoutes(container, authenticator))
    .route("/admin/payouts", createAdminPayoutRoutes(container, authenticator))
    .route("/webhooks/stripe", createStripeWebhookRoutes(container))
    .route("/webhooks/veriff", createVeriffWebhookRoutes(container))
    .route("/email", createEmailRoutes(container))
    .route("/newsletter", createNewsletterRoutes(container))
    .route("/auth", createAuthRoutes(container))
    .route("/categories", createCategoryRoutes(container))
    .route("/venues", createVenueRoutes(container, authenticator))
    .route("/q", createQrRoutes(container))
    .route("/payments", createPaymentRoutes(container, authenticator))
    .route("/marketing", createMarketingRoutes(container, authenticator))
    .route("/submissions", createSubmissionRoutes(container, authenticator))
    .route("/submissions", createSubmissionDocumentRoutes(container, authenticator))
    .route("/uploads", createUploadRoutes(container, authenticator))
    .route("/exports", createExportRoutes(container, authenticator))
    .route("/admin", createAdminRoutes(container, authenticator))
    .route("/webhooks", createWebhookRoutes(container))
    .route("/webhooks", createXeroWebhookRoutes(container));

  assertBullBoardProductionSafety(env);
  mountBullBoard(app, connectionOptionsFromRedisUrl(env.REDIS_URL), env, {
    requireAuth,
    requirePlatformShell,
    requireSuperAdminStaffRole,
    auditAccess: createAuditAccessMiddleware(appLogger),
  });

  return routed;
}

export type AppType = ReturnType<typeof createApp>;
