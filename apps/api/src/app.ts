import { auction } from "@auction/db/schema";
import { sql, eq } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Container } from "./container.js";
import type { Env } from "./env.js";
import { createAppLogger } from "./lib/logger.js";
import { createRateLimitMiddleware } from "./middleware/rate-limit.js";
import { createVerifyOriginMiddleware } from "./middleware/verify-origin.js";
import { createAuctionRoutes } from "./routes/auctions.js";
import { createBidRoutes } from "./routes/bids.js";
import { createCategoryRoutes } from "./routes/categories.js";
import { createPaymentRoutes } from "./routes/payments.js";
import { createUserRoutes } from "./routes/users.js";
import type { IAuthenticator } from "./services/interfaces/authenticator.js";

export function createApp(container: Container, env: Env, authenticator: IAuthenticator) {
  const app = new Hono();
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

  app.use("/auctions/*", createRateLimitMiddleware(container.redis));
  app.use("/bids/*", createRateLimitMiddleware(container.redis));
  app.use("/users/*", createRateLimitMiddleware(container.redis));

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
      .from(auction)
      .where(eq(auction.status, "active"));
    const activeAuctions = activeRow?.n ?? 0;
    return c.json({ activeAuctions });
  });

  app.all("/api/auth/*", (c) => container.auth.handler(c.req.raw));

  const routed = app
    .route("/auctions", createAuctionRoutes(container, authenticator))
    .route("/bids", createBidRoutes(container, authenticator))
    .route("/users", createUserRoutes(container, authenticator))
    .route("/categories", createCategoryRoutes(container))
    .route("/payments", createPaymentRoutes(container, authenticator));

  return routed;
}

export type AppType = ReturnType<typeof createApp>;
