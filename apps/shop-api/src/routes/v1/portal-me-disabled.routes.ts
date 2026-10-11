import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import { ShopApiError } from "../../errors/shop-api-error.js";

function portalFeatureDisabled(): never {
  throw new ShopApiError(
    SHOP_API_ERROR_CODES.FEATURE_DISABLED,
    "Shop portal ownership is disabled",
    404,
  );
}

/** Stable Phase 1 contract when `SHOP_PORTAL_OWNERSHIP_ENABLED` is off (not a missing route). */
export async function registerPortalMeDisabledRoutes(app: FastifyInstance): Promise<void> {
  const routes = [
    "/v1/me/collection",
    "/v1/me/enquiries",
    "/v1/me/editions",
    "/v1/me/sale-authority",
    "/v1/me/sale-authority-requests",
    "/v1/me/payouts",
    "/v1/me/connect/status",
    "/v1/me/connect/account",
    "/v1/me/connect/onboarding-link",
    "/v1/me/sales",
    "/v1/me/documents",
    "/v1/me/artist/artworks",
    "/v1/me/artist/sales",
    "/v1/me/favorites/artworks",
    "/v1/me/favorites/artists",
  ] as const;

  app.all("/v1/me/favorites/artworks/:slug", async () => portalFeatureDisabled());
  app.all("/v1/me/favorites/artists/:slug", async () => portalFeatureDisabled());

  for (const url of routes) {
    app.all(url, async () => portalFeatureDisabled());
  }
}
