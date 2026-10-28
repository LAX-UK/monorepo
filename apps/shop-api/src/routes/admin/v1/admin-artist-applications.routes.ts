import {
  type AdminArtistApplicationAcceptBody,
  AdminArtistApplicationAcceptBodySchema,
  AdminArtistApplicationActionResponseSchema,
  type AdminArtistApplicationAssignBody,
  AdminArtistApplicationAssignBodySchema,
  AdminArtistApplicationConflictBodySchema,
  AdminArtistApplicationDetailSchema,
  type AdminArtistApplicationListQuery,
  AdminArtistApplicationListQuerySchema,
  AdminArtistApplicationListResponseSchema,
  type AdminArtistApplicationMessageBody,
  AdminArtistApplicationMessageBodySchema,
  AdminArtistApplicationReviewersResponseSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ArtistApplicationReviewService } from "../../../application/artist-applications/artist-application-review.service.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";

/** A 2,000-character note can take 4 bytes per character, over the app-wide 1 KiB body cap. */
const MESSAGE_BODY_LIMIT_BYTES = 16_384;

const Params = Type.Object({ id: Type.String({ format: "uuid" }) });

const ACTION_RESPONSES = {
  200: AdminArtistApplicationActionResponseSchema,
  400: ShopApiErrorBodySchema,
  403: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: AdminArtistApplicationConflictBodySchema,
} as const;

/** The reviewer acting and the application they act on, from an authorised request. */
function staffCommand(request: FastifyRequest, expectedVersion: number) {
  requireShopStaffCapability(request, "artist_application.review");
  const { id } = request.params as { id: string };
  return {
    actorSubjectId: requireShopAdminSubject(request),
    applicationId: id,
    expectedVersion,
  };
}

/**
 * The applications queue and its record in LAX Admin. Every route needs
 * `artist_application.review` (admins and catalogue editors); every change is audited by the
 * review service.
 */
export async function registerAdminArtistApplicationRoutes(
  app: FastifyInstance,
  review: ArtistApplicationReviewService,
) {
  app.get(
    "/artist-applications",
    {
      schema: {
        tags: ["shop-admin"],
        querystring: AdminArtistApplicationListQuerySchema,
        response: { 200: AdminArtistApplicationListResponseSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artist_application.review");
      return review.list(
        requireShopAdminSubject(request),
        request.query as AdminArtistApplicationListQuery,
      );
    },
  );

  app.get(
    "/artist-applications/summary",
    {
      schema: {
        tags: ["shop-admin"],
        response: {
          200: Type.Object({ newCount: Type.Integer({ minimum: 0 }) }),
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artist_application.review");
      return review.summary();
    },
  );

  app.get(
    "/artist-applications/reviewers",
    {
      schema: {
        tags: ["shop-admin"],
        response: {
          200: AdminArtistApplicationReviewersResponseSchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artist_application.review");
      return review.reviewers();
    },
  );

  app.get(
    "/artist-applications/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: Params,
        response: {
          200: AdminArtistApplicationDetailSchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "artist_application.review");
      const { id } = request.params as { id: string };
      return review.getDetail(id);
    },
  );

  app.post(
    "/artist-applications/:id/assign",
    {
      schema: {
        tags: ["shop-admin"],
        params: Params,
        body: AdminArtistApplicationAssignBodySchema,
        response: ACTION_RESPONSES,
      },
    },
    async (request) => {
      const body = request.body as AdminArtistApplicationAssignBody;
      return review.assign({
        ...staffCommand(request, body.expectedVersion),
        assigneeSubject: body.assigneeSubject,
      });
    },
  );

  app.post(
    "/artist-applications/:id/request-information",
    {
      bodyLimit: MESSAGE_BODY_LIMIT_BYTES,
      schema: {
        tags: ["shop-admin"],
        params: Params,
        body: AdminArtistApplicationMessageBodySchema,
        response: ACTION_RESPONSES,
      },
    },
    async (request) => {
      const body = request.body as AdminArtistApplicationMessageBody;
      return review.requestInformation({
        ...staffCommand(request, body.expectedVersion),
        message: body.message,
      });
    },
  );

  app.post(
    "/artist-applications/:id/decline",
    {
      bodyLimit: MESSAGE_BODY_LIMIT_BYTES,
      schema: {
        tags: ["shop-admin"],
        params: Params,
        body: AdminArtistApplicationMessageBodySchema,
        response: ACTION_RESPONSES,
      },
    },
    async (request) => {
      const body = request.body as AdminArtistApplicationMessageBody;
      return review.decline({
        ...staffCommand(request, body.expectedVersion),
        reason: body.message,
      });
    },
  );

  app.post(
    "/artist-applications/:id/accept",
    {
      schema: {
        tags: ["shop-admin"],
        params: Params,
        body: AdminArtistApplicationAcceptBodySchema,
        response: ACTION_RESPONSES,
      },
    },
    async (request) => {
      const body = request.body as AdminArtistApplicationAcceptBody;
      return review.accept({
        ...staffCommand(request, body.expectedVersion),
        artistSlug: body.artistSlug,
        importWorksAsDrafts: body.importWorksAsDrafts,
      });
    },
  );
}
