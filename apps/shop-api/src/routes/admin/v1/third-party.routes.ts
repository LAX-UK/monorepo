import { SHOP_API_ERROR_CODES, ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";
import {
  requireRecentFinanceAuthentication,
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const IdResponseSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  status: Type.String(),
});

const CreateHoldBodySchema = Type.Object({
  editionId: Type.String({ format: "uuid" }),
  clientPartyId: Type.String({ format: "uuid" }),
  expiresAt: Type.String({ format: "date-time" }),
  note: Type.Optional(Type.String()),
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
    "/admin/v1/holds",
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
      const subject = requireShopAdminSubject(request);
      const body = request.body as {
        editionId: string;
        clientPartyId: string;
        expiresAt: string;
        note?: string;
      };
      if (request.shopAdminAuth?.role === "broker") {
        const allowed = await deps.staffReader.brokerCanAccessClientParty(
          subject,
          body.clientPartyId,
        );
        if (!allowed) {
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.STAFF_FORBIDDEN,
            "Broker is not assigned to this client",
            403,
          );
        }
      }
      const result = await deps.stockHolds.createHold({
        editionId: body.editionId,
        clientPartyId: body.clientPartyId,
        expiresAt: body.expiresAt,
        actorSubjectId: subject,
        ...(body.note !== undefined ? { note: body.note } : {}),
      });
      return { id: result.holdId, status: result.status };
    },
  );

  app.post(
    "/admin/v1/holds/:holdId/release",
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
      const subject = requireShopAdminSubject(request);
      const params = request.params as { holdId: string };
      const result = await deps.stockHolds.releaseHold({
        holdId: params.holdId,
        actorSubjectId: subject,
      });
      return { id: result.holdId, status: result.status };
    },
  );

  app.post(
    "/admin/v1/third-party-sales",
    {
      schema: {
        tags: ["shop-admin"],
        body: RecordThirdPartySaleBodySchema,
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          501: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "third_party_sale.write");
      const subject = requireShopAdminSubject(request);
      const body = request.body as {
        editionId: string;
        sellerPartyId: string;
        buyerPartyId: string;
        grossPence: number;
      };
      const result = await deps.thirdPartySales.recordSale({
        ...body,
        actorSubjectId: subject,
      });
      return { id: result.saleId, status: result.status };
    },
  );

  app.post(
    "/admin/v1/sale-fees/:feeId/approve",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ feeId: Type.String({ format: "uuid" }) }),
        body: ApproveFeeBodySchema,
        response: {
          200: IdResponseSchema,
          403: ShopApiErrorBodySchema,
          501: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "fee.approve");
      requireRecentFinanceAuthentication(request, deps.financeMaxAuthAgeSeconds);
      const subject = requireShopAdminSubject(request);
      const params = request.params as { feeId: string };
      const result = await deps.saleFees.approveFee({
        feeId: params.feeId,
        actorSubjectId: subject,
      });
      return { id: result.feeId, status: result.status };
    },
  );
}
