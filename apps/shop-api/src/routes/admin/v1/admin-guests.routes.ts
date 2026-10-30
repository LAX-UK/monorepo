import {
  type AdminGuestErasureBody,
  AdminGuestErasureBodySchema,
  AdminGuestErasureResultSchema,
  AdminGuestErasureStateSchema,
  AdminGuestParamsSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import type { GuestErasureService } from "../../../application/guest-erasure/guest-erasure.service.js";
import { ShopApiError, notFound } from "../../../errors/shop-api-error.js";
import {
  requireRecentAuthentication,
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

export type AdminGuestRoutesDeps = {
  guestErasure: GuestErasureService;
  stepUpMaxAuthAgeSeconds: number;
};

type GuestParams = { guestCustomerId: string };

/**
 * A guest's personal data, erased on request. Seeing whether a guest can be erased and erasing
 * both need `lead.erase` (Administrators); erasing also needs a recent sign-in.
 */
export async function registerAdminGuestRoutes(app: FastifyInstance, deps: AdminGuestRoutesDeps) {
  app.get(
    "/guests/:guestCustomerId/erasure",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminGuestParamsSchema,
        response: {
          200: AdminGuestErasureStateSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "lead.erase");
      const { guestCustomerId } = request.params as GuestParams;
      const state = await deps.guestErasure.state(guestCustomerId);
      if (!state) throw notFound("Guest");
      return { ...state, erasedAt: state.erasedAt?.toISOString() ?? null };
    },
  );

  app.post(
    "/guests/:guestCustomerId/erasure",
    {
      schema: {
        tags: ["shop-admin"],
        params: AdminGuestParamsSchema,
        body: AdminGuestErasureBodySchema,
        response: {
          200: AdminGuestErasureResultSchema,
          400: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "lead.erase");
      requireRecentAuthentication(request, deps.stepUpMaxAuthAgeSeconds);
      const actorSubjectId = requireShopAdminSubject(request);
      const { guestCustomerId } = request.params as GuestParams;
      const body = request.body as AdminGuestErasureBody;
      const outcome = await deps.guestErasure.erase({
        guestCustomerId,
        confirmation: body.confirmation,
        reason: body.reason,
        actorSubjectId,
      });
      switch (outcome.kind) {
        case "erased":
          return {
            guestCustomerId,
            erasedAt: outcome.erasedAt.toISOString(),
            orders: outcome.orders,
            enquiries: outcome.enquiries,
            links: outcome.links,
          };
        case "not_found":
          throw notFound("Guest");
        case "blocked":
          throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, outcome.message, 409);
        case "confirmation_mismatch":
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.VALIDATION,
            "The email typed does not match this guest's email",
            400,
          );
        case "reason_invalid":
          throw new ShopApiError(
            SHOP_API_ERROR_CODES.VALIDATION,
            "Say why the data is being erased, in at least 10 characters",
            400,
          );
      }
    },
  );
}
