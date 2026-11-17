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
  REGISTER_CONSIGNOR_LAX,
  REGISTER_CONSIGNOR_NONE,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import type { ArtworkRegisterReviewService } from "../../../application/artwork-register/artwork-register-review.service.js";
import type { RegisterConsignorScope } from "../../../application/ports/artwork-register-review.ports.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";
import { consignorClientScope, requireClientPartyReadAccess } from "./admin-client-access.js";

const READ_ERRORS = { 403: ShopApiErrorBodySchema, 404: ShopApiErrorBodySchema };

/**
 * The From Zoho queue in LAX Admin: artworks that came in from Zoho and are not offered yet,
 * conflicts between Zoho and LAX, the latest nightly check and one artwork's record. Reading
 * needs `artwork_register.read`; deciding a conflict needs `artwork_register.review`.
 *
 * The All tab's Consignor column and filter follow the client pages' rule (ZI-5): people who keep
 * consignor agreements, or read every client, see every consignor; a broker sees only the clients
 * assigned to them, and filtering by any other client is refused with 403, as opening that
 * client's page is. Without `consignor_agreement.read` there is no consignor data at all.
 */
export async function registerAdminArtworkRegisterRoutes(
  app: FastifyInstance,
  review: ArtworkRegisterReviewService,
  deps: Pick<AdminRoutesDeps, "staffReader">,
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
      const auth = requireShopStaffCapability(request, "artwork_register.read");
      const query = request.query as AdminRegisterQueueQuery;
      // Who consigned a work is for people who can read consignor agreements; so is its filter.
      const scope = consignorClientScope(auth);
      if (query.consignor) {
        if (scope === "none") {
          throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Insufficient capability", 403);
        }
        const party =
          query.consignor !== REGISTER_CONSIGNOR_LAX && query.consignor !== REGISTER_CONSIGNOR_NONE;
        if (party && scope === "assigned") {
          await requireClientPartyReadAccess(request, deps, query.consignor);
        }
      }
      const consignorScope: RegisterConsignorScope | undefined =
        scope === "all"
          ? { kind: "all" }
          : scope === "assigned"
            ? { kind: "assigned", brokerSubjectId: auth.subject }
            : undefined;
      return review.listAll(query, consignorScope ? { consignorScope } : {});
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
