import etag from "@fastify/etag";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Fastify from "fastify";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import type { ShopApiAppDeps } from "./container.js";
import { noopArtCacheInvalidator } from "./infrastructure/http-art-cache-invalidator.js";
import { registerPublicCatalogueCaching } from "./plugins/cache-control.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerShopAdminScope } from "./plugins/shop-admin-auth.js";
import { registerShopAuthPlugin } from "./plugins/shop-auth.js";
import { registerAdminArtistApplicationRoutes } from "./routes/admin/v1/admin-artist-applications.routes.js";
import { registerAdminArtistIdentityRoutes } from "./routes/admin/v1/admin-artist-identity.routes.js";
import { registerAdminArtistRoutes } from "./routes/admin/v1/admin-artists.routes.js";
import { registerAdminEditorialRoutes } from "./routes/admin/v1/admin-editorial.routes.js";
import { registerAdminEnquiryRoutes } from "./routes/admin/v1/admin-enquiries.routes.js";
import { registerAdminGuestRoutes } from "./routes/admin/v1/admin-guests.routes.js";
import { registerAdminHelpRoutes } from "./routes/admin/v1/admin-help.routes.js";
import { registerAdminMediaRoutes } from "./routes/admin/v1/admin-media.routes.js";
import { registerAdminMerchandiseRoutes } from "./routes/admin/v1/admin-merchandise.routes.js";
import { registerAdminPeopleRoutes } from "./routes/admin/v1/admin-people.routes.js";
import { registerAdminProductionRoutes } from "./routes/admin/v1/admin-production.routes.js";
import { registerAdminReadRoutes } from "./routes/admin/v1/admin-read.routes.js";
import { registerAdminSavedViewRoutes } from "./routes/admin/v1/admin-saved-views.routes.js";
import { registerArtCacheInvalidation } from "./routes/admin/v1/art-cache-invalidation.js";
import { registerAdminArtworkRoutes } from "./routes/admin/v1/artworks.routes.js";
import { registerAdminEditionRunRoutes } from "./routes/admin/v1/edition-runs.routes.js";
import { registerAdminHealthRoutes } from "./routes/admin/v1/health.routes.js";
import { registerAdminHomeFeatureRoutes } from "./routes/admin/v1/home-features.routes.js";
import { registerAdminOperationsRoutes } from "./routes/admin/v1/operations.routes.js";
import { registerAdminOriginalSaleRoutes } from "./routes/admin/v1/original-sales.routes.js";
import { registerAdminSessionRoutes } from "./routes/admin/v1/session.routes.js";
import { registerAdminThirdPartyRoutes } from "./routes/admin/v1/third-party.routes.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerIdentityDeletionEligibilityRoutes } from "./routes/internal/identity-deletion-eligibility.routes.js";
import { registerArtistApplicationRoutes } from "./routes/v1/artist-application.routes.js";
import { registerArtistRoutes } from "./routes/v1/artists.routes.js";
import { registerArtworkInterestRoutes } from "./routes/v1/artwork-interest.routes.js";
import { registerArtworkRoutes } from "./routes/v1/artworks.routes.js";
import { registerBasketRoutes } from "./routes/v1/basket.routes.js";
import { registerCategoryRoutes } from "./routes/v1/categories.routes.js";
import { registerEditionAlertRoutes } from "./routes/v1/edition-alerts.routes.js";
import { registerEditorialRoutes } from "./routes/v1/editorial.routes.js";
import { registerGuestCheckoutRoutes } from "./routes/v1/guest-checkout.routes.js";
import { registerGuestOrderHelpRoutes } from "./routes/v1/guest-order-help.routes.js";
import { registerHelpRoutes } from "./routes/v1/help.routes.js";
import { registerMerchandiseRoutes } from "./routes/v1/merchandise.routes.js";
import { registerOrderRoutes } from "./routes/v1/orders.routes.js";
import { registerPortalConnectRoutes } from "./routes/v1/portal-connect.routes.js";
import { registerPortalFavoritesRoutes } from "./routes/v1/portal-favorites.routes.js";
import { registerPortalLaxPortfolioRoutes } from "./routes/v1/portal-lax-portfolio.routes.js";
import { registerPortalMeDisabledRoutes } from "./routes/v1/portal-me-disabled.routes.js";
import { registerPortalMeRoutes } from "./routes/v1/portal-me.routes.js";
import { registerStripeConnectWebhookRoutes } from "./routes/webhooks/stripe-connect.routes.js";
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
  void registerIdentityDeletionEligibilityRoutes(app, options.deps.identityDeletion);
  void registerStripeWebhookRoutes(app, options.deps.stripeWebhook);
  if (options.deps.env.SHOP_PAYOUTS_ENABLED) {
    void registerStripeConnectWebhookRoutes(app, options.deps.stripeConnectWebhook);
  }
  void registerArtworkRoutes(app, options.deps.catalogue);
  void registerArtworkInterestRoutes(app, options.deps.interest);
  void registerEditionAlertRoutes(app, options.deps.interest);
  void registerBasketRoutes(app, options.deps.commerce);
  void registerOrderRoutes(app, options.deps.commerce);
  void registerGuestCheckoutRoutes(app, options.deps.commerce.guestCheckout);
  void registerGuestOrderHelpRoutes(
    app,
    options.deps.commerce.guestCheckout,
    options.deps.commerce.orderProblems,
  );
  void registerCategoryRoutes(app, options.deps.catalogue);
  void registerArtistRoutes(app, options.deps.catalogue);
  void registerArtistApplicationRoutes(app, options.deps.artistApplicant);
  if (options.deps.env.SHOP_EDITORIAL_ENABLED && options.deps.editorial) {
    void registerEditorialRoutes(app, options.deps.editorial);
    void registerHelpRoutes(app, options.deps.editorial.help);
  }
  if (options.deps.env.SHOP_MERCHANDISE_ENABLED) {
    void registerMerchandiseRoutes(app, options.deps.merchandise);
  }

  if (options.deps.env.SHOP_ADMIN_ENABLED) {
    void registerShopAdminScope(
      app,
      {
        jwksUrl: options.deps.auth.jwksUrl,
        issuer: options.deps.auth.issuer,
        staffReader: options.deps.staffReader,
      },
      async (adminScope) => {
        await registerAdminHealthRoutes(adminScope, options.deps.admin.health);
        void registerAdminSessionRoutes(adminScope, {
          featureFlags: options.deps.admin.featureFlags,
        });
        void registerAdminReadRoutes(adminScope, options.deps.admin, {
          payoutsEnabled: options.deps.env.SHOP_PAYOUTS_ENABLED,
          thirdPartyEnabled: options.deps.env.SHOP_THIRD_PARTY_ENABLED,
          originalsEnabled: options.deps.env.SHOP_ORIGINALS_ENABLED,
        });
        void registerAdminPeopleRoutes(adminScope, options.deps.admin);
        void registerAdminSavedViewRoutes(adminScope, options.deps.admin.savedViews);
        void registerAdminEnquiryRoutes(adminScope, options.deps.admin.enquiryInbox);
        void registerAdminGuestRoutes(adminScope, options.deps.admin);
        void registerAdminArtistApplicationRoutes(
          adminScope,
          options.deps.admin.artistApplicationReview,
        );
        void registerAdminArtistIdentityRoutes(adminScope, options.deps.admin);
        void registerAdminArtistRoutes(adminScope, options.deps.admin);
        void registerAdminArtworkRoutes(adminScope, options.deps.admin);
        void registerAdminEditionRunRoutes(adminScope, options.deps.admin);
        void registerAdminHomeFeatureRoutes(adminScope, options.deps.admin);
        void registerAdminMediaRoutes(adminScope, options.deps.admin);
        if (options.deps.env.SHOP_EDITORIAL_ENABLED && options.deps.editorial) {
          const editorialDeps = options.deps.editorial;
          void adminScope.register(async (editorialScope) => {
            registerArtCacheInvalidation(
              editorialScope,
              editorialDeps.artCache ?? noopArtCacheInvalidator,
            );
            await registerAdminEditorialRoutes(editorialScope, editorialDeps);
            await registerAdminHelpRoutes(editorialScope, editorialDeps.help);
          });
        }
        if (options.deps.env.SHOP_PAYOUTS_ENABLED) {
          void registerAdminOperationsRoutes(adminScope, options.deps.admin);
          void registerAdminProductionRoutes(adminScope, options.deps.admin.productionTasks);
        }
        if (options.deps.env.SHOP_THIRD_PARTY_ENABLED) {
          void registerAdminThirdPartyRoutes(adminScope, options.deps.admin);
        }
        if (options.deps.env.SHOP_ORIGINALS_ENABLED) {
          void registerAdminOriginalSaleRoutes(adminScope, options.deps.admin);
        }
        if (options.deps.env.SHOP_MERCHANDISE_ENABLED) {
          void registerAdminMerchandiseRoutes(adminScope, options.deps.admin);
        }
      },
    );
  }
  // Registered whatever the portal flags say: a switched-off feature yields a partial response.
  void registerPortalLaxPortfolioRoutes(app, options.deps.portal.laxPortfolio);
  if (options.deps.env.SHOP_PORTAL_OWNERSHIP_ENABLED) {
    void registerPortalMeRoutes(app, {
      ...options.deps.portal,
      payoutsEnabled: options.deps.env.SHOP_PAYOUTS_ENABLED,
    });
    void registerPortalFavoritesRoutes(app, options.deps.portal.portalFavorites);
    if (options.deps.env.SHOP_PAYOUTS_ENABLED) {
      void registerPortalConnectRoutes(app, options.deps.payeeConnect);
    }
  } else {
    void registerPortalMeDisabledRoutes(app);
  }

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
