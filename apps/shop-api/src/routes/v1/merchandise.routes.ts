import {
  PublicMerchandiseProductListSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { MerchandiseRoutesDeps } from "../../merchandise-route-deps.js";

export async function registerMerchandiseRoutes(
  app: FastifyInstance,
  merchandise: MerchandiseRoutesDeps,
): Promise<void> {
  app.get(
    "/v1/merchandise/products",
    {
      schema: {
        tags: ["merchandise"],
        response: {
          200: PublicMerchandiseProductListSchema,
          400: ShopApiErrorBodySchema,
        },
      },
    },
    async () => merchandise.listPublicMerchandiseProducts(),
  );
}
