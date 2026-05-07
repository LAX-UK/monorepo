import { lot } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Container } from "./container.js";
import type { Env } from "./env.js";
import { createAppLogger } from "./lib/logger.js";
import { createAuthRateLimitMiddleware } from "./middleware/auth-rate-limit.js";
import { createMetricsMiddleware, renderMetrics } from "./middleware/metrics.js";
import { createRateLimitMiddleware } from "./middleware/rate-limit.js";
import { requirePlatformAdmin } from "./middleware/require-capability.js";
import { createRequireAuth } from "./middleware/require-auth.js";
import { createRequestIdMiddleware } from "./middleware/request-id.js";
import { createVerifyOriginMiddleware } from "./middleware/verify-origin.js";
import { createPublicInvitationRoutes } from "./routes/admin-invitations.js";
import { createAdminRoutes } from "./routes/admin.js";
import { createArtistRoutes } from "./routes/artists.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createBidRoutes } from "./routes/bids.js";
import { createCategoryRoutes } from "./routes/categories.js";
import { createEmailRoutes } from "./routes/email.js";
import { createInternalCronRoutes } from "./routes/internal-cron.js";
import { createKycRoutes } from "./routes/kyc.js";
import { createActingContextUserRoutes, createLegalEntityRoutes } from "./routes/legal-entities.js";
import { createLegalEntityMemberRoutes } from "./routes/legal-entity-members.js";
import { createLotRoutes } from "./routes/lots.js";
import { createNewsletterRoutes } from "./routes/newsletter.js";
import { createOrganizationRoutes } from "./routes/organizations.js";
import { createPaymentRoutes } from "./routes/payments.js";
import { createLegalEntityPayoutStatementRoutes } from "./routes/payout-statements.js";
import { createAdminPayoutRoutes, createPayoutRoutes } from "./routes/payouts.js";
import { createSaleRoutes } from "./routes/sales.js";
import { createStripeConnectRoutes } from "./routes/stripe-connect.js";
import { createSubmissionRoutes } from "./routes/submissions.js";
import { createUploadRoutes } from "./routes/uploads.js";
import { createUserRoutes } from "./routes/users.js";
import { createWebhookRoutes } from "./routes/webhooks/index.js";
import { createStripeWebhookRoutes } from "./routes/webhooks/stripe.js";
import { createWellKnownRoutes } from "./routes/well-known.js";
import { createXeroWebhookRoutes } from "./routes/xero-webhook.js";
import type { IAuthenticator } from "./services/interfaces/authenticator.js";

export function createApp(container: Container, env: Env, authenticator: IAuthenticator) {
  const app = new Hono();
  app.onError((err, c) => container.httpErrorHandler.handle(err, c));
  const appLogger = createAppLogger(env);
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  /** Process is listening; no DB/Redis (used by container health checks during boot). */
  app.get("/health/live", (c) => c.json({ status: "ok" }));

  app.use("*", createRequestIdMiddleware());
  app.use("*", createMetricsMiddleware());
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
      origin: env.WEB_ORIGIN,
      allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }),
  );
  app.use("*", createVerifyOriginMiddleware(env.WEB_ORIGIN, env.VERIFY_ORIGIN));

  app.use("/lots/*", createRateLimitMiddleware(container.redis));
  app.use("/sales/*", createRateLimitMiddleware(container.redis));
  app.use("/bids/*", createRateLimitMiddleware(container.redis));
  app.use("/users/*", createRateLimitMiddleware(container.redis));
  app.use("/auth/*", createRateLimitMiddleware(container.redis));
  app.use("/payments/*", createRateLimitMiddleware(container.redis));
  app.use("/categories/*", createRateLimitMiddleware(container.redis));
  app.use("/submissions/*", createRateLimitMiddleware(container.redis));
  app.use("/uploads/*", createRateLimitMiddleware(container.redis));
  app.use("/admin/*", createRateLimitMiddleware(container.redis));
  app.use("/legal-entities/*", createRateLimitMiddleware(container.redis));
  app.use("/kyc/*", createRateLimitMiddleware(container.redis));
  app.use("/organizations/*", createRateLimitMiddleware(container.redis));
  app.use("/artists/*", createRateLimitMiddleware(container.redis));
  app.use("/stripe-connect/*", createRateLimitMiddleware(container.redis));
  app.use("/payouts/*", createRateLimitMiddleware(container.redis));
  app.use("/webhooks/postmark", createRateLimitMiddleware(container.redis));
  app.use("/webhooks/postmark/*", createRateLimitMiddleware(container.redis));
  app.use("/webhooks/shopify", createRateLimitMiddleware(container.redis));
  app.use("/webhooks/shopify/*", createRateLimitMiddleware(container.redis));
  app.use("/webhooks/wordpress", createRateLimitMiddleware(container.redis));
  app.use("/webhooks/wordpress/*", createRateLimitMiddleware(container.redis));
  app.use("/webhooks/xero", createRateLimitMiddleware(container.redis));
  app.use("/webhooks/xero/*", createRateLimitMiddleware(container.redis));

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

  app.get("/metrics", requireAuth, requirePlatformAdmin, async (c) => {
    const [activeRow] = await container.db
      .select({ n: sql<number>`count(*)::int` })
      .from(lot)
      .where(eq(lot.status, "active"));
    const activeLots = activeRow?.n ?? 0;
    return c.text(`${await renderMetrics()}auction_api_active_lots ${activeLots}\n`, 200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    });
  });

  app.use("/api/auth/*", createAuthRateLimitMiddleware(container.redis));
  app.all("/api/auth/*", (c) => container.auth.handler(c.req.raw));

  const routed = app
    .route("/internal/jobs", createInternalCronRoutes(container, env))
    .route("/invitations", createPublicInvitationRoutes(container))
    .route("/lots", createLotRoutes(container, authenticator))
    .route("/sales", createSaleRoutes(container, authenticator))
    .route("/bids", createBidRoutes(container, authenticator))
    .route("/users", createUserRoutes(container, authenticator))
    .route("/users", createActingContextUserRoutes(container, authenticator))
    .route("/legal-entities", createLegalEntityPayoutStatementRoutes(container, authenticator))
    .route("/legal-entities", createLegalEntityRoutes(container, authenticator))
    .route("/legal-entities", createLegalEntityMemberRoutes(container, authenticator))
    .route("/kyc", createKycRoutes(container, authenticator))
    .route("/organizations", createOrganizationRoutes(container, authenticator))
    .route("/artists", createArtistRoutes(container, authenticator))
    .route("/stripe-connect", createStripeConnectRoutes(container, authenticator))
    .route("/payouts", createPayoutRoutes(container, authenticator))
    .route("/admin/payouts", createAdminPayoutRoutes(container, authenticator))
    .route("/webhooks/stripe", createStripeWebhookRoutes(container))
    .route("/email", createEmailRoutes(container))
    .route("/newsletter", createNewsletterRoutes(container))
    .route("/auth", createAuthRoutes(container))
    .route("/categories", createCategoryRoutes(container))
    .route("/payments", createPaymentRoutes(container, authenticator))
    .route("/submissions", createSubmissionRoutes(container, authenticator))
    .route("/uploads", createUploadRoutes(container, authenticator))
    .route("/admin", createAdminRoutes(container, authenticator))
    .route("/webhooks", createWebhookRoutes(container))
    .route("/webhooks", createXeroWebhookRoutes(container));

  return routed;
}

export type AppType = ReturnType<typeof createApp>;
