import { ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireRecentFinanceAuthentication,
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const IdResponseSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  status: Type.String(),
});

const CreateProductionTaskBodySchema = Type.Object({
  orderLineId: Type.String({ format: "uuid" }),
  editionId: Type.String({ format: "uuid" }),
});

const UpdateFulfilmentBodySchema = Type.Object({
  fulfilmentId: Type.String({ format: "uuid" }),
  status: Type.String({ minLength: 1 }),
  carrier: Type.Optional(Type.String()),
  trackingNumber: Type.Optional(Type.String()),
});

const RecordPossessionBodySchema = Type.Object({
  fulfilmentId: Type.String({ format: "uuid" }),
  status: Type.String({ minLength: 1 }),
  possessionAt: Type.String({ format: "date-time" }),
});

const RequestRefundBodySchema = Type.Object({
  orderId: Type.String({ format: "uuid" }),
  orderLineId: Type.Optional(Type.String({ format: "uuid" })),
  amountPence: Type.Integer({ minimum: 1 }),
});

const MarkPayoutPaidBodySchema = Type.Object({
  payoutId: Type.String({ format: "uuid" }),
  paidReference: Type.String({ minLength: 1 }),
});

const CancelAfterPossessionBodySchema = Type.Object({
  orderLineId: Type.String({ format: "uuid" }),
  editionId: Type.String({ format: "uuid" }),
});

export async function registerAdminOperationsRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  app.post(
    "/production/tasks",
    {
      schema: {
        tags: ["shop-admin"],
        body: CreateProductionTaskBodySchema,
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          501: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "production.write");
      const subject = requireShopAdminSubject(request);
      const body = request.body as { orderLineId: string; editionId: string };
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await deps.createProductionTask({
        orderLineId: body.orderLineId,
        editionId: body.editionId,
        actorSubjectId: subject,
        idempotencyKey,
      });
      return { id: result.taskId, status: result.status };
    },
  );

  app.patch(
    "/fulfilment",
    {
      schema: {
        tags: ["shop-admin"],
        body: UpdateFulfilmentBodySchema,
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          501: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "fulfilment.write");
      const subject = requireShopAdminSubject(request);
      const body = request.body as {
        fulfilmentId: string;
        status: string;
        carrier?: string;
        trackingNumber?: string;
      };
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await deps.updateFulfilment({
        fulfilmentId: body.fulfilmentId,
        status: body.status,
        actorSubjectId: subject,
        idempotencyKey,
        ...(body.carrier !== undefined ? { carrier: body.carrier } : {}),
        ...(body.trackingNumber !== undefined ? { trackingNumber: body.trackingNumber } : {}),
      });
      return { id: result.fulfilmentId, status: result.status };
    },
  );

  app.post(
    "/fulfilment/possession",
    {
      schema: {
        tags: ["shop-admin"],
        body: RecordPossessionBodySchema,
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          501: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "fulfilment.write");
      requireRecentFinanceAuthentication(request, deps.financeMaxAuthAgeSeconds);
      const subject = requireShopAdminSubject(request);
      const body = request.body as {
        fulfilmentId: string;
        status: string;
        possessionAt: string;
      };
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await deps.recordPossession({
        fulfilmentId: body.fulfilmentId,
        status: body.status,
        possessionAt: body.possessionAt,
        actorSubjectId: subject,
        idempotencyKey,
      });
      return { id: result.fulfilmentId, status: result.status };
    },
  );

  app.post(
    "/cancellations",
    {
      schema: {
        tags: ["shop-admin"],
        body: CancelAfterPossessionBodySchema,
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
          501: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "refund.write");
      requireRecentFinanceAuthentication(request, deps.financeMaxAuthAgeSeconds);
      const subject = requireShopAdminSubject(request);
      const body = request.body as { orderLineId: string; editionId: string };
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await deps.cancelAfterPossession({
        orderLineId: body.orderLineId,
        editionId: body.editionId,
        actorSubjectId: subject,
        idempotencyKey,
      });
      return { id: result.returnId, status: result.status };
    },
  );

  app.post(
    "/refunds",
    {
      schema: {
        tags: ["shop-admin"],
        body: RequestRefundBodySchema,
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          501: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "refund.write");
      requireRecentFinanceAuthentication(request, deps.financeMaxAuthAgeSeconds);
      const subject = requireShopAdminSubject(request);
      const body = request.body as {
        orderId: string;
        orderLineId?: string;
        amountPence: number;
      };
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await deps.requestRefund({
        orderId: body.orderId,
        amountPence: body.amountPence,
        idempotencyKey,
        actorSubjectId: subject,
        ...(body.orderLineId !== undefined ? { orderLineId: body.orderLineId } : {}),
      });
      return { id: result.refundId, status: result.status };
    },
  );

  app.post(
    "/payouts/mark-paid",
    {
      schema: {
        tags: ["shop-admin"],
        body: MarkPayoutPaidBodySchema,
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "payout.mark_paid");
      requireRecentFinanceAuthentication(request, deps.financeMaxAuthAgeSeconds);
      const subject = requireShopAdminSubject(request);
      const body = request.body as { payoutId: string; paidReference: string };
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await deps.markPayoutPaid({
        payoutId: body.payoutId,
        paidReference: body.paidReference,
        actorSubjectId: subject,
        idempotencyKey,
      });
      return { id: result.payoutId, status: result.status };
    },
  );
}
