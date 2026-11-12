import {
  type AdminCatalogueUpdateBody,
  AdminCatalogueUpdateBodySchema,
  AdminCatalogueUpdateResponseSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { type Static, Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const RegisterParams = Type.Object({ registerId: Type.String({ format: "uuid" }) });

const ERRORS = {
  400: ShopApiErrorBodySchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: ShopApiErrorBodySchema,
} as const;

/**
 * "Update from Zoho" on a draft lax.art listing or a draft Bid lot. It changes a copy of the
 * artwork, so it needs what the offer needs: `catalogue.write` and `artwork_register.review`. A
 * published listing, or a lot in a live or upcoming sale, answers 409 and is left as it is.
 * Repeating it is harmless: a draft that already matches changes nothing.
 */
export async function registerAdminCatalogueChangeRoutes(
  app: FastifyInstance,
  deps: Pick<AdminRoutesDeps, "catalogueChange">,
) {
  app.post(
    "/artwork-register/:registerId/catalogue-update",
    {
      schema: {
        tags: ["shop-admin"],
        params: RegisterParams,
        body: AdminCatalogueUpdateBodySchema,
        response: { 200: AdminCatalogueUpdateResponseSchema, ...ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      requireShopStaffCapability(request, "artwork_register.review");
      const { registerId } = request.params as Static<typeof RegisterParams>;
      return deps.catalogueChange.update({
        registerId,
        copy: (request.body as AdminCatalogueUpdateBody).copy,
        actorSubjectId: requireShopAdminSubject(request),
      });
    },
  );
}
