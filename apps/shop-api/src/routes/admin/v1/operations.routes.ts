import {
  ADMIN_REFUND_NOTE_MAX_LENGTH,
  ADMIN_REFUND_REASONS,
  type AdminRefundReason,
  FULFILMENT_CARRIER_MAX_LENGTH,
  FULFILMENT_TRACKING_NUMBER_MAX_LENGTH,
  FULFILMENT_TRACKING_NUMBER_PATTERN,
  PAYOUT_PAID_REFERENCE_MAX_LENGTH,
  SETTLED_OUTSIDE_REASON_MAX_LENGTH,
  SETTLED_OUTSIDE_REFERENCE_MAX_LENGTH,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { SHOP_RETURN_DISPOSITIONS, type ShopReturnDisposition } from "@auction/shop-domain";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireRecentAuthentication,
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const IdResponseSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  status: Type.String(),
  /** For a refund or a cancellation: what was refunded for the frame sold with the print. */
  framingRefundPence: Type.Optional(Type.Integer({ minimum: 0 })),
});

const CreateProductionTaskBodySchema = Type.Object({
  orderLineId: Type.String({ format: "uuid" }),
  editionId: Type.String({ format: "uuid" }),
});

const UpdateFulfilmentBodySchema = Type.Object({
  fulfilmentId: Type.String({ format: "uuid" }),
  status: Type.String({ minLength: 1, maxLength: 40 }),
  carrier: Type.Optional(Type.String({ maxLength: FULFILMENT_CARRIER_MAX_LENGTH })),
  trackingNumber: Type.Optional(
    Type.String({
      maxLength: FULFILMENT_TRACKING_NUMBER_MAX_LENGTH,
      pattern: FULFILMENT_TRACKING_NUMBER_PATTERN,
    }),
  ),
});

const RecordPossessionBodySchema = Type.Object({
  fulfilmentId: Type.String({ format: "uuid" }),
  status: Type.String({ minLength: 1, maxLength: 40 }),
  possessionAt: Type.String({ format: "date-time" }),
});

const RequestRefundBodySchema = Type.Object({
  orderId: Type.String({ format: "uuid" }),
  orderLineId: Type.Optional(Type.String({ format: "uuid" })),
  amountPence: Type.Integer({ minimum: 1 }),
  reason: Type.Optional(Type.Union(ADMIN_REFUND_REASONS.map((reason) => Type.Literal(reason)))),
  note: Type.Optional(Type.String({ maxLength: ADMIN_REFUND_NOTE_MAX_LENGTH })),
});

const RetryRefundBodySchema = Type.Object({
  refundId: Type.String({ format: "uuid" }),
});

const SettleRefundOutsideBodySchema = Type.Object({
  refundId: Type.String({ format: "uuid" }),
  reason: Type.String({ minLength: 1, maxLength: SETTLED_OUTSIDE_REASON_MAX_LENGTH }),
  externalReference: Type.String({
    minLength: 1,
    maxLength: SETTLED_OUTSIDE_REFERENCE_MAX_LENGTH,
  }),
});

const ReturnParamsSchema = Type.Object({ returnId: Type.String({ format: "uuid" }) });

const ReceiveReturnBodySchema = Type.Object({
  disposition: Type.Union(SHOP_RETURN_DISPOSITIONS.map((value) => Type.Literal(value))),
});

const MarkPayoutPaidBodySchema = Type.Object({
  payoutId: Type.String({ format: "uuid" }),
  paidReference: Type.String({ minLength: 1, maxLength: PAYOUT_PAID_REFERENCE_MAX_LENGTH }),
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
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
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
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const subject = requireShopAdminSubject(request);
      const body = request.body as { orderLineId: string; editionId: string };
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await deps.cancelAfterPossession({
        orderLineId: body.orderLineId,
        editionId: body.editionId,
        actorSubjectId: subject,
        idempotencyKey,
      });
      return {
        id: result.returnId ?? result.refundId,
        status: result.status,
        framingRefundPence: result.framingRefundPence,
      };
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
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const subject = requireShopAdminSubject(request);
      const body = request.body as {
        orderId: string;
        orderLineId?: string;
        amountPence: number;
        reason?: AdminRefundReason;
        note?: string;
      };
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await deps.requestRefund({
        orderId: body.orderId,
        amountPence: body.amountPence,
        idempotencyKey,
        actorSubjectId: subject,
        ...(body.orderLineId !== undefined ? { orderLineId: body.orderLineId } : {}),
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
        ...(body.note?.trim() ? { note: body.note.trim() } : {}),
      });
      return {
        id: result.refundId,
        status: result.status,
        framingRefundPence: result.framingRefundPence,
      };
    },
  );

  app.post(
    "/refunds/retry",
    {
      schema: {
        tags: ["shop-admin"],
        body: RetryRefundBodySchema,
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "refund.write");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const subject = requireShopAdminSubject(request);
      const body = request.body as { refundId: string };
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await deps.retryRefund({
        refundId: body.refundId,
        actorSubjectId: subject,
        idempotencyKey,
      });
      return { id: result.refundId, status: result.status };
    },
  );

  app.post(
    "/refunds/settled-outside",
    {
      schema: {
        tags: ["shop-admin"],
        body: SettleRefundOutsideBodySchema,
        response: {
          200: IdResponseSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "refund.write");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const subject = requireShopAdminSubject(request);
      const body = request.body as { refundId: string; reason: string; externalReference: string };
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await deps.markRefundSettledOutside({
        refundId: body.refundId,
        reason: body.reason,
        externalReference: body.externalReference,
        actorSubjectId: subject,
        idempotencyKey,
      });
      return { id: result.refundId, status: result.status };
    },
  );

  app.post(
    "/returns/:returnId/in-transit",
    {
      schema: {
        tags: ["shop-admin"],
        params: ReturnParamsSchema,
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "fulfilment.write");
      const subject = requireShopAdminSubject(request);
      const { returnId } = request.params as { returnId: string };
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await deps.advanceReturn({
        returnId,
        to: "in_transit",
        actorSubjectId: subject,
        idempotencyKey,
      });
      return { id: result.returnId, status: result.status };
    },
  );

  app.post(
    "/returns/:returnId/receive",
    {
      schema: {
        tags: ["shop-admin"],
        params: ReturnParamsSchema,
        body: ReceiveReturnBodySchema,
        response: {
          200: IdResponseSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "fulfilment.write");
      const subject = requireShopAdminSubject(request);
      const { returnId } = request.params as { returnId: string };
      const body = request.body as { disposition: ShopReturnDisposition };
      const idempotencyKey = requireIdempotencyKey(request);
      const result = await deps.advanceReturn({
        returnId,
        to: "received",
        disposition: body.disposition,
        actorSubjectId: subject,
        idempotencyKey,
      });
      return { id: result.returnId, status: result.status };
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
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
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
