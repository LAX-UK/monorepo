import {
  type AdminSavedViewCreateBody,
  AdminSavedViewCreateBodySchema,
  AdminSavedViewIdParamsSchema,
  type AdminSavedViewListKey,
  AdminSavedViewListQuerySchema,
  AdminSavedViewListSchema,
  AdminSavedViewRenameBodySchema,
  AdminSavedViewReorderBodySchema,
  AdminSavedViewSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { SavedViewService } from "../../../application/saved-view.service.js";
import { requireShopStaffAuth } from "../../../plugins/shop-admin-auth.js";

const CREATE_BODY_LIMIT_BYTES = 4096;

/** The signed-in person, read from the session and never from the request. */
function actorOf(request: FastifyRequest) {
  const { subject, capabilities } = requireShopStaffAuth(request);
  return { subject, capabilities };
}

/**
 * The signed-in staff member's own saved table views. Open to any staff member, but each list
 * needs the capability that opens it, and a person only ever reaches their own views.
 */
export async function registerAdminSavedViewRoutes(
  app: FastifyInstance,
  savedViews: SavedViewService,
) {
  app.get(
    "/saved-views",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminSavedViewListQuerySchema,
        response: {
          200: AdminSavedViewListSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) =>
      savedViews.list(
        actorOf(request),
        (request.query as { listKey: AdminSavedViewListKey }).listKey,
      ),
  );

  app.post(
    "/saved-views",
    {
      // A view's query can be up to 1000 characters; the app-wide limit is smaller.
      bodyLimit: CREATE_BODY_LIMIT_BYTES,
      schema: {
        tags: ["shop-admin"],
        body: AdminSavedViewCreateBodySchema,
        response: {
          201: AdminSavedViewSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      const view = await savedViews.create(
        actorOf(request),
        request.body as AdminSavedViewCreateBody,
      );
      return reply.code(201).send(view);
    },
  );

  app.put(
    "/saved-views/order",
    {
      schema: {
        tags: ["shop-admin"],
        body: AdminSavedViewReorderBodySchema,
        response: {
          200: AdminSavedViewListSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      const body = request.body as { listKey: AdminSavedViewListKey; ids: string[] };
      return savedViews.reorder(actorOf(request), body.listKey, body.ids);
    },
  );

  app.patch(
    "/saved-views/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminSavedViewIdParamsSchema,
        body: AdminSavedViewRenameBodySchema,
        response: {
          200: AdminSavedViewSchema,
          400: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) =>
      savedViews.rename(
        actorOf(request),
        (request.params as { id: string }).id,
        (request.body as { label: string }).label,
      ),
  );

  app.delete(
    "/saved-views/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminSavedViewIdParamsSchema,
        response: { 204: Type.Null(), 400: ShopApiErrorBodySchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      await savedViews.remove(actorOf(request), (request.params as { id: string }).id);
      return reply.code(204).send();
    },
  );
}
