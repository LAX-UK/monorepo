import {
  type AdminPrintPartyCreateBody,
  AdminPrintPartyCreateBodySchema,
  AdminPrintPartyListSchema,
  AdminPrintPartySchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { PrintPartyStore } from "../../../application/ports/print-party.store.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const tags = ["shop-admin"];
const ERRORS = { 403: ShopApiErrorBodySchema, 404: ShopApiErrorBodySchema };

/**
 * The printers and publishers list in Settings. Anyone who edits edition facts reads it to pick
 * a name; changing it takes `settings.write`.
 */
export async function registerAdminPrintPartyRoutes(app: FastifyInstance, store: PrintPartyStore) {
  app.get(
    "/print-parties",
    { schema: { tags, response: { 200: AdminPrintPartyListSchema, ...ERRORS } } },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      return { items: await store.list() };
    },
  );

  app.post(
    "/print-parties",
    {
      schema: {
        tags,
        body: AdminPrintPartyCreateBodySchema,
        response: { 201: AdminPrintPartySchema, 409: ShopApiErrorBodySchema, ...ERRORS },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "settings.write");
      const name = (request.body as AdminPrintPartyCreateBody).name.trim();
      if (!name) {
        throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Enter a name", 400);
      }
      const added = await store.add(name, requireShopAdminSubject(request));
      if (added === "exists") {
        throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, "That name is already listed", 409);
      }
      return reply.code(201).send(added);
    },
  );

  app.delete(
    "/print-parties/:id",
    {
      schema: {
        tags,
        params: Type.Object({ id: Type.String({ format: "uuid" }) }),
        response: { 204: Type.Null(), ...ERRORS },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "settings.write");
      if (!(await store.remove((request.params as { id: string }).id))) {
        throw notFound("That name is not listed");
      }
      return reply.code(204).send();
    },
  );
}
