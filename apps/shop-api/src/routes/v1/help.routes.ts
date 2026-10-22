import {
  HelpArticleDetailSchema,
  HelpArticleListQuerySchema,
  HelpArticleListSchema,
  HelpCategoryListSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { HelpRepository } from "../../application/ports/help.repository.js";
import { notFound } from "../../errors/shop-api-error.js";

/** Public Help centre reads. Only published questions in published categories are ever returned. */
export async function registerHelpRoutes(app: FastifyInstance, help: HelpRepository) {
  app.get(
    "/v1/help/categories",
    { schema: { tags: ["help"], response: { 200: HelpCategoryListSchema } } },
    async () => ({ items: await help.listCategories() }),
  );

  app.get(
    "/v1/help/articles",
    {
      schema: {
        tags: ["help"],
        querystring: HelpArticleListQuerySchema,
        response: { 200: HelpArticleListSchema },
      },
    },
    async (request) => {
      const { category, q } = request.query as { category?: string; q?: string };
      return {
        items: await help.listArticles({
          ...(category ? { categorySlug: category } : {}),
          ...(q?.trim() ? { q } : {}),
        }),
      };
    },
  );

  app.get(
    "/v1/help/articles/:slug",
    {
      schema: {
        tags: ["help"],
        params: Type.Object({ slug: Type.String() }),
        response: { 200: HelpArticleDetailSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const article = await help.getArticleBySlug(slug);
      if (!article) throw notFound("Question not found");
      return article;
    },
  );
}
