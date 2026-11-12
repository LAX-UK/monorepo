import {
  AdminSoldAttentionListSchema,
  type AdminSoldAttentionOverrideBody,
  AdminSoldAttentionOverrideBodySchema,
  AdminSoldAttentionOverrideResultSchema,
  AdminSoldAttentionParamsSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { SoldAttentionReviewService } from "../../../application/artwork-register/sold-attention-review.service.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

/**
 * Artworks Zoho says are Sold or Reserved that are still for sale. Reading needs
 * `artwork_register.read`; "It is not sold" needs `artwork_register.review`.
 */
export async function registerAdminSoldAttentionRoutes(
  app: FastifyInstance,
  service: SoldAttentionReviewService,
) {
  app.get(
    "/artwork-register/attention",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminSoldAttentionListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      return service.list();
    },
  );

  app.post(
    "/artwork-register/attention/:attentionId/not-sold",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminSoldAttentionParamsSchema,
        body: AdminSoldAttentionOverrideBodySchema,
        response: {
          200: AdminSoldAttentionOverrideResultSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.review");
      const { attentionId } = request.params as { attentionId: string };
      const outcome = await service.override({
        attentionId,
        body: request.body as AdminSoldAttentionOverrideBody,
        actorSubjectId: requireShopAdminSubject(request),
      });
      switch (outcome.kind) {
        case "overridden":
          return outcome.result;
        case "not_found":
          throw notFound("Item");
        case "not_open":
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "This has already been dealt with",
            409,
          );
        case "reason_required":
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.VALIDATION,
            "Say why it is not sold. The reason is kept in the artwork's history.",
            400,
          );
        case "reason_too_long":
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.VALIDATION,
            "Keep the reason to 500 characters or fewer.",
            400,
          );
      }
    },
  );
}
