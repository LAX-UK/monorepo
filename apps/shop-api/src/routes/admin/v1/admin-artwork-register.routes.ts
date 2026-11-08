import {
  AdminRegisterAllListSchema,
  AdminRegisterConflictListSchema,
  AdminRegisterConflictParamsSchema,
  AdminRegisterCountsSchema,
  AdminRegisterDetailSchema,
  AdminRegisterLastCheckSchema,
  AdminRegisterNewListSchema,
  AdminRegisterParamsSchema,
  type AdminRegisterQueueQuery,
  AdminRegisterQueueQuerySchema,
  type AdminRegisterResolveBody,
  AdminRegisterResolveBodySchema,
  AdminRegisterResolveResultSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { ArtworkRegisterReviewService } from "../../../application/artwork-register/artwork-register-review.service.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const READ_ERRORS = { 403: ShopApiErrorBodySchema, 404: ShopApiErrorBodySchema };

/**
 * The From Zoho queue in LAX Admin: artworks that came in from Zoho and are not offered yet,
 * conflicts between Zoho and LAX, the latest nightly check and one artwork's record. Reading
 * needs `artwork_register.read`; deciding a conflict needs `artwork_register.review`.
 */
export async function registerAdminArtworkRegisterRoutes(
  app: FastifyInstance,
  review: ArtworkRegisterReviewService,
) {
  app.get(
    "/artwork-register/new",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminRegisterQueueQuerySchema,
        response: { 200: AdminRegisterNewListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      return review.listNew(request.query as AdminRegisterQueueQuery);
    },
  );

  app.get(
    "/artwork-register/all",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminRegisterQueueQuerySchema,
        response: { 200: AdminRegisterAllListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      return review.listAll(request.query as AdminRegisterQueueQuery);
    },
  );

  app.get(
    "/artwork-register/counts",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminRegisterCountsSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      return review.queueCounts();
    },
  );

  app.get(
    "/artwork-register/conflicts",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminRegisterQueueQuerySchema,
        response: { 200: AdminRegisterConflictListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      return review.listConflicts(request.query as AdminRegisterQueueQuery);
    },
  );

  app.get(
    "/artwork-register/last-check",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminRegisterLastCheckSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      return review.lastCheck();
    },
  );

  app.get(
    "/artwork-register/:registerId",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminRegisterParamsSchema,
        response: { 200: AdminRegisterDetailSchema, ...READ_ERRORS },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.read");
      const { registerId } = request.params as { registerId: string };
      const detail = await review.get(registerId);
      if (!detail) throw notFound("Artwork");
      return detail;
    },
  );

  app.post(
    "/artwork-register/conflicts/:conflictId/resolve",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminRegisterConflictParamsSchema,
        body: AdminRegisterResolveBodySchema,
        response: {
          200: AdminRegisterResolveResultSchema,
          ...READ_ERRORS,
          400: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artwork_register.review");
      const { conflictId } = request.params as { conflictId: string };
      const outcome = await review.resolve({
        conflictId,
        body: request.body as AdminRegisterResolveBody,
        actorSubjectId: requireShopAdminSubject(request),
      });
      switch (outcome.kind) {
        case "resolved":
          return outcome.result;
        case "not_found":
          throw notFound("Conflict");
        case "already_resolved":
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "Someone has already decided this one",
            409,
          );
        case "invalid_stock_code":
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "Zoho's stock code is not valid for this artwork, so it cannot be accepted. The conflict stays open.",
            409,
          );
        case "stock_code_taken":
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.CONFLICT,
            "Another artwork already uses Zoho's stock code, so it cannot be accepted. The conflict stays open.",
            409,
          );
        case "cannot_accept_field":
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.VALIDATION,
            "This is set in LAX. Keep the LAX value.",
            400,
          );
      }
    },
  );
}
