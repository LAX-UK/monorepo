import {
  EditorialCreateResponseSchema,
  EditorialEntityConflictBodySchema,
  EditorialIdParamsSchema,
  EditorialUpdateResponseSchema,
  HelpAdminArticleDetailSchema,
  HelpAdminArticleListQuerySchema,
  HelpAdminArticleRowSchema,
  HelpAdminCategoryRowSchema,
  HelpArticleUpdateBodySchema,
  HelpArticleWriteBodySchema,
  HelpCategoryUpdateBodySchema,
  HelpCategoryWriteBodySchema,
  HelpOrderBodySchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type {
  HelpRepository,
  HelpWriteOutcome,
} from "../../../application/ports/help.repository.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";
import { sendUpdateOutcome } from "./admin-editorial.routes.js";

const UpdateResponses = {
  200: EditorialUpdateResponseSchema,
  404: ShopApiErrorBodySchema,
  409: EditorialEntityConflictBodySchema,
} as const;

/** Maps the failures a help write can report to their HTTP errors; `ok` returns its value. */
function unwrap<T>(outcome: HelpWriteOutcome<T>, label: string): T {
  switch (outcome.status) {
    case "ok":
      return outcome.value;
    case "not_found":
      throw notFound(`${label} not found`);
    case "unknown_category":
      throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Category does not exist", 400);
    case "not_empty":
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.CONFLICT,
        "Move or delete this category's questions first",
        409,
      );
    case "list_changed":
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.CONFLICT,
        "The list changed since it was opened. Reload it and try again",
        409,
      );
  }
}

export async function registerAdminHelpRoutes(app: FastifyInstance, repo: HelpRepository) {
  app.get(
    "/help/categories",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: Type.Object({ items: Type.Array(HelpAdminCategoryRowSchema) }) },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "editorial.write");
      return { items: await repo.listAdminCategories() };
    },
  );

  app.post(
    "/help/categories",
    {
      schema: {
        tags: ["shop-admin"],
        body: HelpCategoryWriteBodySchema,
        response: { 201: EditorialCreateResponseSchema, 409: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const body = request.body as { slug: string; title: string };
      const created = await repo.createCategory({
        ...body,
        updatedBy: requireShopAdminSubject(request),
      });
      return reply.status(201).send(created);
    },
  );

  app.put(
    "/help/categories/order",
    {
      schema: {
        tags: ["shop-admin"],
        body: HelpOrderBodySchema,
        response: { 204: Type.Null(), 409: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const { ids } = request.body as { ids: string[] };
      unwrap(await repo.reorderCategories(ids, requireShopAdminSubject(request)), "Category");
      return reply.status(204).send();
    },
  );

  app.put(
    "/help/categories/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        body: HelpCategoryUpdateBodySchema,
        response: UpdateResponses,
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const { id } = request.params as { id: string };
      const body = request.body as { slug: string; title: string; expectedVersion: string };
      const outcome = await repo.updateCategory(id, {
        ...body,
        updatedBy: requireShopAdminSubject(request),
      });
      return sendUpdateOutcome(request, reply, "Category", outcome);
    },
  );

  for (const [verb, published] of [
    ["publish", true],
    ["unpublish", false],
  ] as const) {
    app.post(
      `/help/categories/:id/${verb}`,
      {
        schema: {
          tags: ["shop-admin"],
          params: EditorialIdParamsSchema,
          response: { 204: Type.Null(), 404: ShopApiErrorBodySchema },
        },
      },
      async (request, reply) => {
        requireShopStaffCapability(request, "editorial.publish");
        const { id } = request.params as { id: string };
        if (!(await repo.setCategoryPublication(id, published, requireShopAdminSubject(request)))) {
          throw notFound("Category not found");
        }
        return reply.status(204).send();
      },
    );
  }

  app.delete(
    "/help/categories/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 204: Type.Null(), 404: ShopApiErrorBodySchema, 409: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const { id } = request.params as { id: string };
      unwrap(await repo.deleteCategory(id, requireShopAdminSubject(request)), "Category");
      return reply.status(204).send();
    },
  );

  app.put(
    "/help/categories/:id/articles/order",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        body: HelpOrderBodySchema,
        response: { 204: Type.Null(), 404: ShopApiErrorBodySchema, 409: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const { id } = request.params as { id: string };
      const { ids } = request.body as { ids: string[] };
      unwrap(await repo.reorderArticles(id, ids, requireShopAdminSubject(request)), "Category");
      return reply.status(204).send();
    },
  );

  app.get(
    "/help/articles",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: HelpAdminArticleListQuerySchema,
        response: { 200: Type.Object({ items: Type.Array(HelpAdminArticleRowSchema) }) },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "editorial.write");
      return {
        items: await repo.listAdminArticles(
          request.query as Parameters<HelpRepository["listAdminArticles"]>[0],
        ),
      };
    },
  );

  app.get(
    "/help/articles/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 200: HelpAdminArticleDetailSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "editorial.write");
      const { id } = request.params as { id: string };
      const row = await repo.getAdminArticleById(id);
      if (!row) throw notFound("Question not found");
      return row;
    },
  );

  app.post(
    "/help/articles",
    {
      schema: {
        tags: ["shop-admin"],
        body: HelpArticleWriteBodySchema,
        response: {
          201: EditorialCreateResponseSchema,
          400: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const body = request.body as Omit<
        Parameters<HelpRepository["createArticle"]>[0],
        "updatedBy"
      >;
      const created = unwrap(
        await repo.createArticle({ ...body, updatedBy: requireShopAdminSubject(request) }),
        "Question",
      );
      return reply.status(201).send(created);
    },
  );

  app.put(
    "/help/articles/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        body: HelpArticleUpdateBodySchema,
        response: { ...UpdateResponses, 400: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const { id } = request.params as { id: string };
      const body = request.body as Omit<
        Parameters<HelpRepository["updateArticle"]>[1],
        "updatedBy"
      >;
      const outcome = await repo.updateArticle(id, {
        ...body,
        updatedBy: requireShopAdminSubject(request),
      });
      if (outcome.status === "unknown_category") {
        throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Category does not exist", 400);
      }
      return sendUpdateOutcome(request, reply, "Question", outcome);
    },
  );

  for (const [verb, published] of [
    ["publish", true],
    ["unpublish", false],
  ] as const) {
    app.post(
      `/help/articles/:id/${verb}`,
      {
        schema: {
          tags: ["shop-admin"],
          params: EditorialIdParamsSchema,
          response: { 204: Type.Null(), 404: ShopApiErrorBodySchema },
        },
      },
      async (request, reply) => {
        requireShopStaffCapability(request, "editorial.publish");
        const { id } = request.params as { id: string };
        if (!(await repo.setArticlePublication(id, published, requireShopAdminSubject(request)))) {
          throw notFound("Question not found");
        }
        return reply.status(204).send();
      },
    );
  }

  app.delete(
    "/help/articles/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 204: Type.Null(), 404: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const { id } = request.params as { id: string };
      if (!(await repo.deleteArticle(id, requireShopAdminSubject(request)))) {
        throw notFound("Question not found");
      }
      return reply.status(204).send();
    },
  );
}
