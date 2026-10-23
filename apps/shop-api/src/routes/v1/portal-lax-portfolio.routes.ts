import { LaxMoneyResponseV1, LaxPortfolioResponseV1 } from "@auction/lax-ecosystem";
import { ShopApiErrorBodySchema } from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { LaxPortfolioHandlers } from "../../application/lax-portfolio/lax-portfolio.handler.js";
import { requireAnyShopScope, requireShopSubject } from "../../plugins/shop-auth.js";

/**
 * Read-only views of the signed-in person's Shop and lax.art works and money, in the shared
 * LAX portfolio shape. Besides the `shop.read` scope the storefronts already use, they accept
 * the narrower `lax.portfolio.read`, which opens these two routes only. Responses are
 * `no-store` through the API-wide non-catalogue cache policy.
 */
export async function registerPortalLaxPortfolioRoutes(
  app: FastifyInstance,
  handlers: LaxPortfolioHandlers,
) {
  app.get(
    "/v1/me/lax-portfolio",
    {
      schema: {
        tags: ["shop-portal"],
        response: { 200: LaxPortfolioResponseV1, 401: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireAnyShopScope(request, ["shop.read", "lax.portfolio.read"]);
      return handlers.getPortfolio(requireShopSubject(request));
    },
  );

  app.get(
    "/v1/me/lax-money",
    {
      schema: {
        tags: ["shop-portal"],
        response: { 200: LaxMoneyResponseV1, 401: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireAnyShopScope(request, ["shop.read", "lax.portfolio.read"]);
      return handlers.getMoney(requireShopSubject(request));
    },
  );
}
