import { ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const IdResponseSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  status: Type.String(),
});

const CreateOriginalSaleBodySchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  buyerPartyId: Type.String({ format: "uuid" }),
  salePricePence: Type.Integer({ minimum: 0 }),
  reservationExpiresAt: Type.Optional(Type.String({ format: "date-time" })),
});

export async function registerAdminOriginalSaleRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  app.post(
    "/admin/v1/original-sales",
    {
      schema: {
        tags: ["shop-admin"],
        body: CreateOriginalSaleBodySchema,
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          501: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "original_sale.write");
      const subject = requireShopAdminSubject(request);
      const body = request.body as {
        artworkId: string;
        buyerPartyId: string;
        salePricePence: number;
        reservationExpiresAt?: string;
      };
      const result = await deps.originalSales.createReservation({
        artworkId: body.artworkId,
        buyerPartyId: body.buyerPartyId,
        salePricePence: body.salePricePence,
        actorSubjectId: subject,
        ...(body.reservationExpiresAt !== undefined
          ? { reservationExpiresAt: body.reservationExpiresAt }
          : {}),
      });
      return { id: result.originalSaleId, status: result.status };
    },
  );
}
