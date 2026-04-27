import { lot } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Container } from "./container.js";
import type { Env } from "./env.js";
import { createAppLogger } from "./lib/logger.js";
import { createAuthRateLimitMiddleware } from "./middleware/auth-rate-limit.js";
import { createRateLimitMiddleware } from "./middleware/rate-limit.js";
import { createVerifyOriginMiddleware } from "./middleware/verify-origin.js";
import { createAdminRoutes } from "./routes/admin.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createBidRoutes } from "./routes/bids.js";
import { createCategoryRoutes } from "./routes/categories.js";
import { createLotRoutes } from "./routes/lots.js";
import { createPaymentRoutes } from "./routes/payments.js";
import { createSaleRoutes } from "./routes/sales.js";
import { createSubmissionRoutes } from "./routes/submissions.js";
import { createUploadRoutes } from "./routes/uploads.js";
import { createUserRoutes } from "./routes/users.js";
import { createXeroWebhookRoutes } from "./routes/xero-webhook.js";
import type { IAuthenticator } from "./services/interfaces/authenticator.js";

export function createApp(container: Container, env: Env, authenticator: IAuthenticator) {
  const app = new Hono();
  app.onError((err, c) => container.httpErrorHandler.handle(err, c));
  const appLogger = createAppLogger(env);

  /** Process is listening; no DB/Redis (used by container health checks during boot). */
  app.get("/health/live", (c) => c.json({ status: "ok" }));

  app.use("*", logger());
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

  app.get("/health", async (c) => {
    try {
      await container.db.execute(sql`select 1`);
      await container.redis.ping();
      return c.json({ status: "ok", database: "ok", redis: "ok" });
    } catch (e) {
      appLogger.error("health_check_failed", { err: String(e) });
      return c.json({ status: "degraded" }, 503);
    }
  });

  app.get("/metrics", async (c) => {
    const [activeRow] = await container.db
      .select({ n: sql<number>`count(*)::int` })
      .from(lot)
      .where(eq(lot.status, "active"));
    const activeLots = activeRow?.n ?? 0;
    return c.json({ activeLots });
  });

  app.use("/api/auth/*", createAuthRateLimitMiddleware(container.redis));
  app.all("/api/auth/*", (c) => container.auth.handler(c.req.raw));

  const routed = app
    .route("/lots", createLotRoutes(container, authenticator))
    .route("/sales", createSaleRoutes(container, authenticator))
    .route("/bids", createBidRoutes(container, authenticator))
    .route("/users", createUserRoutes(container, authenticator))
    .route("/auth", createAuthRoutes(container))
    .route("/categories", createCategoryRoutes(container))
    .route("/payments", createPaymentRoutes(container, authenticator))
    .route("/submissions", createSubmissionRoutes(container, authenticator))
    .route("/uploads", createUploadRoutes(container, authenticator))
    .route("/admin", createAdminRoutes(container, authenticator))
    .route("/webhooks", createXeroWebhookRoutes(container));

  return routed;
}

export type AppType = ReturnType<typeof createApp>;
