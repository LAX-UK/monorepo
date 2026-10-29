import { ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireRecentAuthentication,
  requireShopAdminSubject,
  requireShopStaffAuth,
  requireShopStaffCapability,
  staffCan,
} from "../../../plugins/shop-admin-auth.js";

const IdResponseSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  status: Type.String(),
});

const CreateHoldBodySchema = Type.Object({
  editionId: Type.String({ format: "uuid" }),
  clientPartyId: Type.String({ format: "uuid" }),
  expiresAt: Type.String({ format: "date-time" }),
  note: Type.Optional(Type.String({ maxLength: 1000 })),
});

const RecordThirdPartySaleBodySchema = Type.Object({
  editionId: Type.String({ format: "uuid" }),
  sellerPartyId: Type.String({ format: "uuid" }),
  buyerPartyId: Type.String({ format: "uuid" }),
  grossPence: Type.Integer({ minimum: 0 }),
});

const ApproveFeeBodySchema = Type.Object({
  feeId: Type.String({ format: "uuid" }),
});

export async function registerAdminThirdPartyRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  app.post(
    "/holds",
    {
      schema: {
        tags: ["shop-admin"],
        body: CreateHoldBodySchema,
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          501: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "stock_hold.write");
      const idempotencyKey = requireIdempotencyKey(request);
      const subject = requireShopAdminSubject(request);
      const body = request.body as {
        editionId: string;
        clientPartyId: string;
        expiresAt: string;
        note?: string;
      };
      const auth = requireShopStaffAuth(request);
      const result = await deps.createStockHold({
        editionId: body.editionId,
        clientPartyId: body.clientPartyId,
        expiresAt: body.expiresAt,
        actorSubjectId: subject,
        actorMayOverride: staffCan(auth, "stock_hold.override"),
        idempotencyKey,
        ...(body.note !== undefined ? { note: body.note } : {}),
      });
      return { id: result.holdId, status: result.status };
    },
  );

  app.post(
    "/holds/:holdId/release",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ holdId: Type.String({ format: "uuid" }) }),
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "stock_hold.write");
      const idempotencyKey = requireIdempotencyKey(request);
      const subject = requireShopAdminSubject(request);
      const params = request.params as { holdId: string };
      const auth = requireShopStaffAuth(request);
      const result = await deps.stockHolds.releaseHold(
        {
          holdId: params.holdId,
          actorSubjectId: subject,
          actorMayOverride: staffCan(auth, "stock_hold.override"),
        },
        { idempotencyKey, actorSubjectId: subject },
      );
      return { id: result.holdId, status: result.status };
    },
  );

  app.post(
    "/third-party-sales",
    {
      schema: {
        tags: ["shop-admin"],
        body: RecordThirdPartySaleBodySchema,
        response: {
          200: IdResponseSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
          501: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "third_party_sale.write");
      const idempotencyKey = requireIdempotencyKey(request);
      const subject = requireShopAdminSubject(request);
      const body = request.body as {
        editionId: string;
        sellerPartyId: string;
        buyerPartyId: string;
        grossPence: number;
      };
      const result = await deps.thirdPartySales.recordSale(
        { ...body, actorSubjectId: subject },
        { idempotencyKey, actorSubjectId: subject },
      );
      return { id: result.saleId, status: result.status };
    },
  );

  app.post(
    "/sale-fees/:feeId/approve",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ feeId: Type.String({ format: "uuid" }) }),
        body: ApproveFeeBodySchema,
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
          501: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "fee.approve");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const idempotencyKey = requireIdempotencyKey(request);
      const subject = requireShopAdminSubject(request);
      const params = request.params as { feeId: string };
      const result = await deps.saleFees.approveFee(
        { feeId: params.feeId, actorSubjectId: subject },
        { idempotencyKey, actorSubjectId: subject },
      );
      return { id: result.feeId, status: result.status };
    },
  );
}
