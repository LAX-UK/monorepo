import {
  AdminRegisterParamsSchema,
  type AdminRegisterReopenBody,
  AdminRegisterReopenBodySchema,
  AdminRegisterReopenResultSchema,
  AdminSoldAttentionDealtWithResultSchema,
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
  requireRecentAuthentication,
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

/**
 * Artworks Zoho says are Sold or Reserved that are still for sale. Reading needs
 * `artwork_register.read`; "It is not sold" and "Dealt with" need `artwork_register.review`.
 * Reopening a sale made in the gallery is for Administrators (`artwork_register.reopen_sold`).
 * "Dealt with" and Reopen are staff resolutions of a sale, so both also need a recent sign-in.
 */
export async function registerAdminSoldAttentionRoutes(
  app: FastifyInstance,
  service: SoldAttentionReviewService,
  deps: { stepUpMaxAuthAgeSeconds: number },
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

  app.post(
    "/artwork-register/attention/:attentionId/dealt-with",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminSoldAttentionParamsSchema,
        response: {
          200: AdminSoldAttentionDealtWithResultSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.review");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const { attentionId } = request.params as { attentionId: string };
      const outcome = await service.dealtWith({
        attentionId,
        actorSubjectId: requireShopAdminSubject(request),
      });
      switch (outcome.kind) {
        case "dealt_with":
          return outcome.result;
        case "not_found":
          throw notFound("Item");
        case "not_open":
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "This has already been dealt with",
            409,
          );
        case "not_sold_in_gallery":
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "This artwork is still for sale. Withdraw it, or use It is not sold.",
            409,
          );
      }
    },
  );

  app.post(
    "/artwork-register/:registerId/reopen-sale",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminRegisterParamsSchema,
        body: AdminRegisterReopenBodySchema,
        response: {
          200: AdminRegisterReopenResultSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.reopen_sold");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const { registerId } = request.params as { registerId: string };
      const body = request.body as AdminRegisterReopenBody;
      const outcome = await service.reopen({
        registerId,
        reason: body.reason,
        actorSubjectId: requireShopAdminSubject(request),
      });
      switch (outcome.kind) {
        case "reopened":
          return outcome.result;
        case "not_found":
          throw notFound("Artwork");
        case "version_conflict":
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "This artwork changed a moment ago. Check it again.",
            409,
          );
        case "refused": {
          const validation =
            outcome.refusal === "reason_required" || outcome.refusal === "reason_too_long";
          throw new ShopApiError(
            validation ? SHOP_API_ERROR_CODES.VALIDATION : SHOP_API_ERROR_CODES.CONFLICT,
            outcome.message,
            validation ? 400 : 409,
          );
        }
      }
    },
  );
}
