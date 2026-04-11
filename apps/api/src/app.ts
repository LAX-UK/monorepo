import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Container } from "./container.js";
import type { Env } from "./env.js";
import { createRateLimitMiddleware } from "./middleware/rate-limit.js";
import { createAuctionRoutes } from "./routes/auctions.js";
import { createBidRoutes } from "./routes/bids.js";
import { createCategoryRoutes } from "./routes/categories.js";
import { createPaymentRoutes } from "./routes/payments.js";
import { createUserRoutes } from "./routes/users.js";
import type { IAuthenticator } from "./services/interfaces/authenticator.js";

export function createApp(container: Container, env: Env, authenticator: IAuthenticator) {
  const app = new Hono();

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: env.WEB_ORIGIN,
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }),
  );

  app.use("/auctions/*", createRateLimitMiddleware(container.redis));
  app.use("/bids/*", createRateLimitMiddleware(container.redis));
  app.use("/users/*", createRateLimitMiddleware(container.redis));

  app.get("/health", (c) => c.json({ status: "ok" }));

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
