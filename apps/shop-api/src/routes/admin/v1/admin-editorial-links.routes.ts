import {
  EditorialExhibitionLinkListSchema,
  EditorialExhibitionLinksResponseSchema,
  EditorialIdParamsSchema,
  EditorialLinkCandidatesQuerySchema,
  EditorialLinkCandidatesResponseSchema,
  EditorialLinksConflictBodySchema,
  EditorialLinksReplaceBodySchema,
  EditorialLinksReplaceResponseSchema,
  EditorialLinksUnknownIdsBodySchema,
  EditorialStoryLinkListSchema,
  EditorialStoryLinksResponseSchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type {
  EditorialLinkCandidatesQuery,
  EditorialLinksReplaceBody,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { EditorialLinksService } from "../../../application/editorial-links.service.js";
import type { ReplaceEditorialLinksOutcome } from "../../../application/ports/editorial-links.repository.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

/** The app-wide 1 KiB body cap would reject any list over about 25 ids; 200 uuids need about 8 KiB. */
const REPLACE_BODY_LIMIT_BYTES = 16_384;

const ReplaceResponses = {
  200: EditorialLinksReplaceResponseSchema,
  404: ShopApiErrorBodySchema,
  409: EditorialLinksConflictBodySchema,
  422: EditorialLinksUnknownIdsBodySchema,
} as const;

function sendOutcome(
  request: FastifyRequest,
  reply: FastifyReply,
  parentLabel: string,
  outcome: ReplaceEditorialLinksOutcome,
) {
  switch (outcome.status) {
    case "replaced":
      return reply.status(200).send({ version: outcome.version });
    case "parent_not_found":
      return reply.status(404).send({
        code: SHOP_API_ERROR_CODES.NOT_FOUND,
        message: `${parentLabel} not found`,
        requestId: request.id,
      });
    case "stale":
      return reply.status(409).send({
        code: SHOP_API_ERROR_CODES.CONFLICT,
        message: "The links changed since they were loaded; reload and try again",
        requestId: request.id,
        currentVersion: outcome.currentVersion,
      });
    case "unknown_ids":
      return reply.status(422).send({
        code: SHOP_API_ERROR_CODES.VALIDATION,
        message: `Unknown ids: ${outcome.missingIds.join(", ")}`,
        requestId: request.id,
        missingIds: outcome.missingIds,
      });
  }
}

/**
 * Links are editorial content, so reads need `editorial.read` and writes `editorial.write`;
 * publishing the parent stays a separate `editorial.publish` decision.
 */
export async function registerAdminEditorialLinksRoutes(
  app: FastifyInstance,
  links: EditorialLinksService,
) {
  app.get(
    "/editorial/exhibitions/:id/links",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 200: EditorialExhibitionLinksResponseSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.read");
      const { id } = request.params as { id: string };
      const result = await links.getExhibitionLinks(id);
      if (!result) {
        return reply
          .status(404)
          .send({ code: SHOP_API_ERROR_CODES.NOT_FOUND, message: "Exhibition not found" });
      }
      return result;
    },
  );

  app.get(
    "/editorial/stories/:id/links",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 200: EditorialStoryLinksResponseSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.read");
      const { id } = request.params as { id: string };
      const result = await links.getStoryLinks(id);
      if (!result) {
        return reply
          .status(404)
          .send({ code: SHOP_API_ERROR_CODES.NOT_FOUND, message: "Story not found" });
      }
      return result;
    },
  );

  app.put(
    "/editorial/exhibitions/:id/links/:list",
    {
      bodyLimit: REPLACE_BODY_LIMIT_BYTES,
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({
          id: EditorialIdParamsSchema.properties.id,
          list: EditorialExhibitionLinkListSchema,
        }),
        body: EditorialLinksReplaceBodySchema,
        response: ReplaceResponses,
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const actorSubjectId = requireShopAdminSubject(request);
      const { id, list } = request.params as {
        id: string;
        list: "artworks" | "artists" | "stories";
      };
      const body = request.body as EditorialLinksReplaceBody;
      const outcome = await links.replaceExhibitionLinks({
        parentId: id,
        list,
        ids: body.ids,
        expectedVersion: body.expectedVersion,
        actorSubjectId,
      });
      return sendOutcome(request, reply, "Exhibition", outcome);
    },
  );

  app.put(
    "/editorial/stories/:id/links/:list",
    {
      bodyLimit: REPLACE_BODY_LIMIT_BYTES,
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({
          id: EditorialIdParamsSchema.properties.id,
          list: EditorialStoryLinkListSchema,
        }),
        body: EditorialLinksReplaceBodySchema,
        response: ReplaceResponses,
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const actorSubjectId = requireShopAdminSubject(request);
      const { id, list } = request.params as {
        id: string;
        list: "artists" | "artworks" | "exhibitions";
      };
      const body = request.body as EditorialLinksReplaceBody;
      const outcome = await links.replaceStoryLinks({
        parentId: id,
        list,
        ids: body.ids,
        expectedVersion: body.expectedVersion,
        actorSubjectId,
      });
      return sendOutcome(request, reply, "Story", outcome);
    },
  );

  app.get(
    "/editorial/link-candidates",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: EditorialLinkCandidatesQuerySchema,
        response: { 200: EditorialLinkCandidatesResponseSchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "editorial.write");
      return links.searchCandidates(request.query as EditorialLinkCandidatesQuery);
    },
  );
}
