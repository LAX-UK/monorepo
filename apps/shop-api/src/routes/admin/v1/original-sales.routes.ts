import { ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
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
  salesChannel: Type.Optional(Type.Union([Type.Literal("shop"), Type.Literal("art")])),
});

const IssueOriginalSaleInvoiceBodySchema = Type.Object({
  buyerEmail: Type.String({ format: "email" }),
  buyerName: Type.Optional(Type.String()),
});

const IssueOriginalSaleInvoiceResponseSchema = Type.Object({
  originalSaleId: Type.String({ format: "uuid" }),
  status: Type.Literal("invoiced"),
  stripeInvoiceId: Type.String(),
  hostedInvoiceUrl: Type.Union([Type.String(), Type.Null()]),
});

export async function registerAdminOriginalSaleRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  app.post(
    "/original-sales",
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
      requireIdempotencyKey(request);
      const subject = requireShopAdminSubject(request);
      const body = request.body as {
        artworkId: string;
        buyerPartyId: string;
        salePricePence: number;
        reservationExpiresAt?: string;
        salesChannel?: "shop" | "art";
      };
      const result = await deps.originalSales.createReservation({
        artworkId: body.artworkId,
        buyerPartyId: body.buyerPartyId,
        salePricePence: body.salePricePence,
        actorSubjectId: subject,
        ...(body.reservationExpiresAt !== undefined
          ? { reservationExpiresAt: body.reservationExpiresAt }
          : {}),
        ...(body.salesChannel !== undefined ? { salesChannel: body.salesChannel } : {}),
      });
      return { id: result.originalSaleId, status: result.status };
    },
  );

  app.post(
    "/original-sales/:originalSaleId/invoice",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ originalSaleId: Type.String({ format: "uuid" }) }),
        body: IssueOriginalSaleInvoiceBodySchema,
        response: {
          200: IssueOriginalSaleInvoiceResponseSchema,
          403: ShopApiErrorBodySchema,
          501: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "original_sale.write");
      requireIdempotencyKey(request);
      const subject = requireShopAdminSubject(request);
      const { originalSaleId } = request.params as { originalSaleId: string };
      const body = request.body as { buyerEmail: string; buyerName?: string };
      const idempotencyKey = request.headers["idempotency-key"] as string;
      return deps.originalSales.issueInvoice({
        originalSaleId,
        buyerEmail: body.buyerEmail,
        actorSubjectId: subject,
        idempotencyKey,
        ...(body.buyerName !== undefined ? { buyerName: body.buyerName } : {}),
      });
    },
  );
}
