import {
  PublicMerchandiseProductDetailSchema,
  PublicMerchandiseProductListSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { notFound } from "../../errors/shop-api-error.js";
import type { MerchandiseRoutesDeps } from "../../merchandise-route-deps.js";
const ListQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
  cursor: Type.Optional(Type.String()),
});

export async function registerMerchandiseRoutes(
  app: FastifyInstance,
  merchandise: MerchandiseRoutesDeps,
) {
  app.get(
    "/v1/merchandise/products",
    {
      schema: {
        tags: ["merchandise"],
        querystring: ListQuerySchema,
        response: {
          200: PublicMerchandiseProductListSchema,
          400: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const query = request.query as { limit?: number; cursor?: string };
      return merchandise.listPublicMerchandiseProducts(query);
    },
  );

  app.get(
    "/v1/merchandise/products/:slug",
    {
      schema: {
        tags: ["merchandise"],
        params: Type.Object({ slug: Type.String({ minLength: 1 }) }),
        response: {
          200: PublicMerchandiseProductDetailSchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const product = await merchandise.getPublicMerchandiseProduct(slug);
      if (!product) {
        throw notFound("Product");
      }
      return product;
    },
  );
}
