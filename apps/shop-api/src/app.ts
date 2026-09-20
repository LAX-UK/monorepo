import etag from "@fastify/etag";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Fastify from "fastify";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import type { ShopApiAppDeps } from "./container.js";
import { registerPublicCatalogueCaching } from "./plugins/cache-control.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerShopAuthPlugin } from "./plugins/shop-auth.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerArtistRoutes } from "./routes/v1/artists.routes.js";
import { registerArtworkInterestRoutes } from "./routes/v1/artwork-interest.routes.js";
import { registerArtworkRoutes } from "./routes/v1/artworks.routes.js";
import { registerBasketRoutes } from "./routes/v1/basket.routes.js";
import { registerCategoryRoutes } from "./routes/v1/categories.routes.js";
import { registerOrderRoutes } from "./routes/v1/orders.routes.js";
import { registerStripeWebhookRoutes } from "./routes/webhooks/stripe.routes.js";

export type CreateShopApiAppOptions = {
  deps: ShopApiAppDeps;
  logger?: boolean;
};

export function createShopApiApp(options: CreateShopApiAppOptions) {
  const metricsRegistry = new Registry();
  collectDefaultMetrics({ register: metricsRegistry, prefix: "shop_api_" });
  const httpDuration = new Histogram({
    name: "shop_api_http_request_duration_seconds",
    help: "Shop API HTTP request duration in seconds",
    labelNames: ["route", "status"] as const,
    registers: [metricsRegistry],
  });
  const httpRequests = new Counter({
    name: "shop_api_http_requests_total",
    help: "Shop API HTTP requests",
    labelNames: ["route", "status"] as const,
    registers: [metricsRegistry],
  });

  const app = Fastify({
    logger: options.logger ?? true,
    genReqId: () => crypto.randomUUID(),
    bodyLimit: 1024,
    ajv: {
      customOptions: {
        removeAdditional: "all",
        coerceTypes: "array",
      },
    },
  }).withTypeProvider<TypeBoxTypeProvider>();

  registerErrorHandler(app);
  registerShopAuthPlugin(app, options.deps.auth);
  void app.register(etag);
  void app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    allowList: (request) =>
      request.url.startsWith("/health") ||
      request.url.startsWith("/metrics") ||
      request.url.startsWith("/webhooks/"),
  });
  registerPublicCatalogueCaching(app);

  app.addHook("onRequest", (request, _reply, done) => {
    request.metricsStart = performance.now();
    done();
  });
  app.addHook("onResponse", (request, reply, done) => {
    const route =
      request.routeOptions.url ??
      (request.url.startsWith("/v1/artworks/")
        ? "/v1/artworks/:slug"
        : request.url.split("?")[0]) ??
      "unknown";
    const started = request.metricsStart ?? performance.now();
    const labels = { route, status: String(reply.statusCode) };
    httpDuration.observe(labels, (performance.now() - started) / 1000);
    httpRequests.inc(labels);
    done();
  });

  app.get("/metrics", async (request, reply) => {
    if (options.deps.env.METRICS_TOKEN) {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (token !== options.deps.env.METRICS_TOKEN) {
        return reply.status(401).send("Unauthorized");
      }
    }
    reply.header("Content-Type", metricsRegistry.contentType);
    return metricsRegistry.metrics();
  });

  void registerHealthRoutes(app, options.deps.health);
  void registerStripeWebhookRoutes(app, options.deps.stripeWebhook);
  void registerArtworkRoutes(app, options.deps.catalogue);
  void registerArtworkInterestRoutes(app, options.deps.interest);
  void registerBasketRoutes(app, options.deps.commerce);
  void registerOrderRoutes(app, options.deps.commerce);
  void registerCategoryRoutes(app, options.deps.catalogue);
  void registerArtistRoutes(app, options.deps.catalogue);

  void app.register(swagger, {
    openapi: {
      info: {
        title: "LAX Shop API",
        version: "1.0.0",
      },
      servers: [{ url: options.deps.env.SHOP_API_PUBLIC_BASE_URL }],
    },
  });
  if (options.deps.env.NODE_ENV !== "production") {
    void app.register(swaggerUi, { routePrefix: "/docs" });
  }

  return app;
}

export type ShopApiApp = ReturnType<typeof createShopApiApp>;
