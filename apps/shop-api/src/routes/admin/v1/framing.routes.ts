import {
  FramingConflictBodySchema,
  type FramingOfferBody,
  FramingOfferBodySchema,
  type FramingOptionBody,
  FramingOptionBodySchema,
  FramingOptionListSchema,
  FramingOptionParamsSchema,
  FramingOptionSchema,
  type FramingOptionUpdateBody,
  FramingOptionUpdateBodySchema,
  FramingRejectedBodySchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { FRAMING_EDIT_CAPABILITY, FRAMING_READ_CAPABILITY } from "@auction/shop-domain";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { requireIdempotencyKey } from "../../../plugins/require-idempotency-key.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

const optionIdOf = (request: FastifyRequest) => (request.params as { optionId: string }).optionId;

const writeErrors = {
  400: FramingRejectedBodySchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: FramingConflictBodySchema,
};

/**
 * The framing catalogue in LAX Admin: ready-made framing options, each priced per size band.
 * Anyone who can open the catalogue can read it; adding, editing, offering and pausing options
 * needs catalogue edit rights.
 */
export async function registerAdminFramingRoutes(
  app: FastifyInstance,
  deps: Pick<AdminRoutesDeps, "framing">,
) {
  app.get(
    "/framing-options",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: FramingOptionListSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, FRAMING_READ_CAPABILITY);
      return deps.framing.list();
    },
  );

  app.post(
    "/framing-options",
    {
      schema: {
        tags: ["shop-admin"],
        body: FramingOptionBodySchema,
        response: { 201: FramingOptionSchema, ...writeErrors },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, FRAMING_EDIT_CAPABILITY);
      const option = await deps.framing.create({
        body: request.body as FramingOptionBody,
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
      });
      return reply.code(201).send(option);
    },
  );

  app.put(
    "/framing-options/:optionId",
    {
      schema: {
        tags: ["shop-admin"],
        params: FramingOptionParamsSchema,
        body: FramingOptionUpdateBodySchema,
        response: { 200: FramingOptionSchema, ...writeErrors },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, FRAMING_EDIT_CAPABILITY);
      return deps.framing.update({
        optionId: optionIdOf(request),
        body: request.body as FramingOptionUpdateBody,
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
      });
    },
  );

  app.put(
    "/framing-options/:optionId/offered",
    {
      schema: {
        tags: ["shop-admin"],
        params: FramingOptionParamsSchema,
        body: FramingOfferBodySchema,
        response: { 200: FramingOptionSchema, ...writeErrors },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, FRAMING_EDIT_CAPABILITY);
      return deps.framing.offer({
        optionId: optionIdOf(request),
        body: request.body as FramingOfferBody,
        actorSubjectId: requireShopAdminSubject(request),
        idempotencyKey: requireIdempotencyKey(request),
      });
    },
  );
}
