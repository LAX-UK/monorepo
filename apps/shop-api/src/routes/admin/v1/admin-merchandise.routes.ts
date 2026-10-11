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

const CreateProductBodySchema = Type.Object({
  slug: Type.String({ minLength: 1, maxLength: 120 }),
  title: Type.String({ minLength: 1, maxLength: 200 }),
  description: Type.Optional(Type.String({ maxLength: 4000 })),
  sku: Type.String({ minLength: 1, maxLength: 64 }),
  pricePence: Type.Integer({ minimum: 0 }),
  onHand: Type.Integer({ minimum: 0 }),
});

const CreateProductResponseSchema = Type.Object({
  productId: Type.String({ format: "uuid" }),
  variantId: Type.String({ format: "uuid" }),
  slug: Type.String(),
});

export async function registerAdminMerchandiseRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  app.post(
    "/merchandise/products",
    {
      schema: {
        tags: ["shop-admin"],
        body: CreateProductBodySchema,
        response: {
          200: CreateProductResponseSchema,
          403: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "merchandise.write");
      const subject = requireShopAdminSubject(request);
      const idempotencyKey = requireIdempotencyKey(request);
      const body = request.body as {
        slug: string;
        title: string;
        description?: string;
        sku: string;
        pricePence: number;
        onHand: number;
      };
      return deps.createMerchandiseProduct({
        ...body,
        actorSubjectId: subject,
        idempotencyKey,
      });
    },
  );

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
