import {
  PublicCategoryListSchema,
  PublicCategorySummarySchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { CatalogueRoutesDeps } from "../../catalogue-route-deps.js";
import { notFound } from "../../errors/shop-api-error.js";
import {
  presentCategoryList,
  presentCategorySummary,
} from "../../presenters/catalogue.presenter.js";

const ListQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 50 })),
  placement: Type.Optional(Type.Literal("featured_categories")),
  cursor: Type.Optional(Type.String()),
});

export async function registerCategoryRoutes(app: FastifyInstance, catalogue: CatalogueRoutesDeps) {
  app.get(
    "/v1/categories",
    {
      schema: {
        tags: ["catalogue"],
        querystring: ListQuerySchema,
        response: {
          200: PublicCategoryListSchema,
          400: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const query = request.query as {
        limit?: number;
        placement?: "featured_categories";
        cursor?: string;
      };
      const result = await catalogue.listPublicCategories({
        limit: query.limit ?? 50,
        ...(query.placement ? { placement: query.placement } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
      });
      return presentCategoryList(result);
    },
  );

  app.get(
    "/v1/categories/:slug",
    {
      schema: {
        tags: ["catalogue"],
        params: Type.Object({ slug: Type.String({ minLength: 1 }) }),
        response: {
          200: PublicCategorySummarySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const category = await catalogue.getPublicCategory(slug);
      if (!category) {
        throw notFound("Category not found");
      }
      return presentCategorySummary(category);
    },
  );
}
