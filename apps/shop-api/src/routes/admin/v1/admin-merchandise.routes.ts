import { ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const AdjustStockBodySchema = Type.Object({
  onHand: Type.Integer({ minimum: 0 }),
});

const AdjustStockResponseSchema = Type.Object({
  variantId: Type.String({ format: "uuid" }),
  onHand: Type.Integer({ minimum: 0 }),
});

export async function registerAdminMerchandiseRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  app.post(
    "/merchandise/variants/:variantId/adjust-stock",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ variantId: Type.String({ format: "uuid" }) }),
        body: AdjustStockBodySchema,
        response: {
          200: AdjustStockResponseSchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "merchandise.write");
      const subject = requireShopAdminSubject(request);
      const idempotencyKey = requireIdempotencyKey(request);
      const { variantId } = request.params as { variantId: string };
      const body = request.body as { onHand: number };
      return deps.adjustMerchandiseStock({
        variantId,
        onHand: body.onHand,
        actorSubjectId: subject,
        idempotencyKey,
      });
    },
  );
}
