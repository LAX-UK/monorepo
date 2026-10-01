import { ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
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
  possessionAt: Type.Optional(Type.String({ format: "date-time" })),
});

const RequestRefundBodySchema = Type.Object({
  orderId: Type.String({ format: "uuid" }),
  orderLineId: Type.Optional(Type.String({ format: "uuid" })),
  amountPence: Type.Integer({ minimum: 1 }),
  idempotencyKey: Type.String({ minLength: 8 }),
});

const MarkPayoutPaidBodySchema = Type.Object({
  payoutId: Type.String({ format: "uuid" }),
  paidReference: Type.String({ minLength: 1 }),
});

export async function registerAdminOperationsRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  app.post(
    "/admin/v1/production/tasks",
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
      const result = await deps.production.createTask({
        orderLineId: body.orderLineId,
        editionId: body.editionId,
        actorSubjectId: subject,
      });
      return { id: result.taskId, status: result.status };
    },
  );

  app.patch(
    "/admin/v1/fulfilment",
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
        possessionAt?: string;
      };
      const result = await deps.fulfilment.updateStatus({
        fulfilmentId: body.fulfilmentId,
        status: body.status,
        actorSubjectId: subject,
        ...(body.carrier !== undefined ? { carrier: body.carrier } : {}),
        ...(body.trackingNumber !== undefined ? { trackingNumber: body.trackingNumber } : {}),
        ...(body.possessionAt !== undefined ? { possessionAt: body.possessionAt } : {}),
      });
      return { id: result.fulfilmentId, status: result.status };
    },
  );

  app.post(
    "/admin/v1/refunds",
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
        idempotencyKey: string;
      };
      const result = await deps.refunds.requestRefund({
        orderId: body.orderId,
        amountPence: body.amountPence,
        idempotencyKey: body.idempotencyKey,
        actorSubjectId: subject,
        ...(body.orderLineId !== undefined ? { orderLineId: body.orderLineId } : {}),
      });
      return { id: result.refundId, status: result.status };
    },
  );

  app.post(
    "/admin/v1/payouts/mark-paid",
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
      const result = await deps.payouts.markPaid({
        payoutId: body.payoutId,
        paidReference: body.paidReference,
        actorSubjectId: subject,
      });
      return { id: result.payoutId, status: result.status };
    },
  );
}
