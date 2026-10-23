import {
  EditorialCreateResponseSchema,
  EditorialEntityConflictBodySchema,
  EditorialExhibitionUpdateBodySchema,
  EditorialExhibitionWriteBodySchema,
  EditorialIdParamsSchema,
  EditorialPageUpdateBodySchema,
  EditorialPageWriteBodySchema,
  EditorialPlacementItemSchema,
  EditorialPlacementSlotParamSchema,
  EditorialStoryCategorySchema,
  EditorialStoryKindSchema,
  EditorialStoryUpdateBodySchema,
  EditorialStoryWriteBodySchema,
  EditorialUpdateResponseSchema,
  EditorialVenueUpdateBodySchema,
  EditorialVenueWriteBodySchema,
  SHOP_API_ERROR_CODES,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { EditorialUpdateOutcome } from "../../../application/ports/editorial.repository.js";
import {
  type EditorialPreviewEntity,
  signEditorialPreviewToken,
} from "../../../domain/editorial-preview-token.js";
import type { EditorialRoutesDeps } from "../../../editorial-route-deps.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";
import { registerAdminEditorialLinksRoutes } from "./admin-editorial-links.routes.js";

const PreviewTokenBodySchema = Type.Object({
  entity: Type.Union([
    Type.Literal("venue"),
    Type.Literal("exhibition"),
    Type.Literal("story"),
    Type.Literal("page"),
    Type.Literal("help_article"),
  ]),
  id: Type.String({ format: "uuid" }),
});

const PreviewTokenResponseSchema = Type.Object({
  token: Type.String(),
  expiresAt: Type.String({ format: "date-time" }),
});

const AdminRowSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  slug: Type.String(),
  status: Type.Union([Type.Literal("draft"), Type.Literal("published")]),
  label: Type.String(),
  updatedAt: Type.String({ format: "date-time" }),
});

const AdminVenueListRowSchema = Type.Intersect([
  AdminRowSchema,
  Type.Object({ city: Type.Union([Type.String(), Type.Null()]) }),
]);

const AdminStoryListRowSchema = Type.Intersect([
  AdminRowSchema,
  Type.Object({ kind: EditorialStoryKindSchema }),
]);

const AdminExhibitionListRowSchema = Type.Intersect([
  AdminRowSchema,
  Type.Object({
    kind: Type.Union([Type.Literal("exhibition"), Type.Literal("film"), Type.Literal("event")]),
    startsOn: Type.Union([Type.String(), Type.Null()]),
    endsOn: Type.Union([Type.String(), Type.Null()]),
  }),
]);

const AdminSeoFieldsSchema = Type.Object({
  seoTitle: Type.Union([Type.String(), Type.Null()]),
  seoDescription: Type.Union([Type.String(), Type.Null()]),
});

const AdminPageDetailSchema = Type.Intersect([
  AdminRowSchema,
  AdminSeoFieldsSchema,
  Type.Object({
    title: Type.String(),
    body: Type.Array(Type.Unknown()),
  }),
]);

const NullableString = Type.Union([Type.String(), Type.Null()]);
const NullableInteger = Type.Union([Type.Integer(), Type.Null()]);

const AdminVenueDetailSchema = Type.Intersect([
  AdminRowSchema,
  Type.Object({
    name: Type.String(),
    address: Type.Union([Type.String(), Type.Null()]),
    postcode: Type.Union([Type.String(), Type.Null()]),
    openingHours: Type.Union([Type.Unknown(), Type.Null()]),
    phone: Type.Union([Type.String(), Type.Null()]),
    email: Type.Union([Type.String(), Type.Null()]),
    mapUrl: Type.Union([Type.String(), Type.Null()]),
    coverMediaKey: Type.Union([Type.String(), Type.Null()]),
    body: Type.Array(Type.Unknown()),
    streetLine: NullableString,
    city: NullableString,
    latitude: Type.Union([Type.Number(), Type.Null()]),
    longitude: Type.Union([Type.Number(), Type.Null()]),
  }),
]);

const AdminStoryDetailSchema = Type.Intersect([
  AdminRowSchema,
  AdminSeoFieldsSchema,
  Type.Object({
    kind: EditorialStoryKindSchema,
    title: Type.String(),
    standfirst: Type.Union([Type.String(), Type.Null()]),
    coverMediaKey: Type.Union([Type.String(), Type.Null()]),
    videoUrl: Type.Union([Type.String(), Type.Null()]),
    featured: Type.Boolean(),
    body: Type.Array(Type.Unknown()),
    category: Type.Union([EditorialStoryCategorySchema, Type.Null()]),
    authorName: NullableString,
    readMinutes: NullableInteger,
    series: NullableString,
    episodeNumber: NullableInteger,
    audioUrl: NullableString,
    durationSeconds: NullableInteger,
    publicationName: NullableString,
    externalUrl: NullableString,
  }),
]);

const AdminExhibitionDetailSchema = Type.Intersect([
  AdminRowSchema,
  Type.Object({
    kind: Type.Union([Type.Literal("exhibition"), Type.Literal("film"), Type.Literal("event")]),
    title: Type.String(),
    summary: Type.Union([Type.String(), Type.Null()]),
    venueId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    startsOn: Type.Union([Type.String(), Type.Null()]),
    endsOn: Type.Union([Type.String(), Type.Null()]),
    timesNote: Type.Union([Type.String(), Type.Null()]),
    coverMediaKey: Type.Union([Type.String(), Type.Null()]),
    featured: Type.Boolean(),
    body: Type.Array(Type.Unknown()),
    subtitle: NullableString,
    contactName: NullableString,
    contactRole: NullableString,
    contactEmail: NullableString,
    contactPhone: NullableString,
    contactAvatarMediaKey: NullableString,
  }),
]);

const PlacementRowSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  slot: Type.String(),
  position: Type.Integer(),
  refKind: Type.String(),
  refId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  headline: Type.Union([Type.String(), Type.Null()]),
  mediaKey: Type.Union([Type.String(), Type.Null()]),
  linkUrl: Type.Union([Type.String(), Type.Null()]),
  body: NullableString,
  ctaLabel: NullableString,
  publishedAt: Type.Union([Type.String(), Type.Null()]),
});

function adminSubject(request: FastifyRequest): string {
  return requireShopAdminSubject(request);
}

/**
 * A stale save is a 409 that carries the row's current version so the editor can offer to
 * reload or to save again on top of it.
 */
export function sendUpdateOutcome(
  request: FastifyRequest,
  reply: FastifyReply,
  label: string,
  outcome: EditorialUpdateOutcome,
) {
  switch (outcome.status) {
    case "updated":
      return reply.status(200).send({ version: outcome.version });
    case "not_found":
      return reply
        .status(404)
        .send({ code: SHOP_API_ERROR_CODES.NOT_FOUND, message: `${label} not found` });
    case "stale":
      return reply.status(409).send({
        code: SHOP_API_ERROR_CODES.CONFLICT,
        message: `${label} was changed by someone else since it was opened`,
        requestId: request.id,
        currentVersion: outcome.currentVersion,
      });
  }
}

const UpdateResponses = {
  200: EditorialUpdateResponseSchema,
  404: ShopApiErrorBodySchema,
  409: EditorialEntityConflictBodySchema,
} as const;

export async function registerAdminEditorialRoutes(
  app: FastifyInstance,
  deps: EditorialRoutesDeps,
) {
  const repo = deps.editorial;
  await registerAdminEditorialLinksRoutes(app, deps.links);

  app.get(
    "/editorial/venues",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: Type.Object({ items: Type.Array(AdminVenueListRowSchema) }) },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "editorial.write");
      return { items: await repo.listAdminVenues() };
    },
  );

  app.get(
    "/editorial/exhibitions",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: Type.Object({ items: Type.Array(AdminExhibitionListRowSchema) }) },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "editorial.write");
      return { items: await repo.listAdminExhibitions() };
    },
  );

  app.get(
    "/editorial/stories",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: Type.Object({ items: Type.Array(AdminStoryListRowSchema) }) },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "editorial.write");
      return { items: await repo.listAdminStories() };
    },
  );

  app.get(
    "/editorial/pages",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: Type.Object({ items: Type.Array(AdminRowSchema) }) },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "editorial.write");
      return { items: await repo.listAdminPages() };
    },
  );

  app.get(
    "/editorial/placements",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: Type.Object({ items: Type.Array(PlacementRowSchema) }) },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "editorial.write");
      return { items: await repo.listAdminPlacements() };
    },
  );

  app.put(
    "/editorial/placements/:slot",
    {
      schema: {
        tags: ["shop-admin"],
        params: Type.Object({ slot: EditorialPlacementSlotParamSchema }),
        body: Type.Object({ items: Type.Array(EditorialPlacementItemSchema) }),
        response: { 204: Type.Null(), 403: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.publish");
      const subject = adminSubject(request);
      const { slot } = request.params as { slot: string };
      const body = request.body as {
        items: Array<{
          position: number;
          refKind: string;
          refId: string | null;
          headline: string | null;
          mediaKey: string | null;
          linkUrl: string | null;
        }>;
      };
      await repo.replacePlacementSlot(slot, body.items, subject);
      return reply.status(204).send();
    },
  );

  app.get(
    "/editorial/pages/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: {
          200: AdminPageDetailSchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const { id } = request.params as { id: string };
      const row = await repo.getAdminPageById(id);
      if (!row) {
        return reply.status(404).send({ code: "not_found", message: "Page not found" });
      }
      return row;
    },
  );

  app.post(
    "/editorial/pages",
    {
      schema: {
        tags: ["shop-admin"],
        body: EditorialPageWriteBodySchema,
        response: { 201: EditorialCreateResponseSchema, 403: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const subject = adminSubject(request);
      const body = request.body as Omit<Parameters<typeof repo.createPage>[0], "updatedBy">;
      const created = await repo.createPage({ ...body, updatedBy: subject });
      return reply.status(201).send(created);
    },
  );

  app.put(
    "/editorial/pages/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        body: EditorialPageUpdateBodySchema,
        response: { ...UpdateResponses, 403: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      const body = request.body as Omit<Parameters<typeof repo.updatePage>[1], "updatedBy">;
      const outcome = await repo.updatePage(id, { ...body, updatedBy: subject });
      return sendUpdateOutcome(request, reply, "Page", outcome);
    },
  );

  app.post(
    "/editorial/pages/:id/publish",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 204: Type.Null(), 403: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.publish");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      await repo.setPagePublication(id, true, subject);
      return reply.status(204).send();
    },
  );

  app.post(
    "/editorial/pages/:id/unpublish",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 204: Type.Null(), 403: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.publish");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      await repo.setPagePublication(id, false, subject);
      return reply.status(204).send();
    },
  );

  app.get(
    "/editorial/venues/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 200: AdminVenueDetailSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const { id } = request.params as { id: string };
      const row = await repo.getAdminVenueById(id);
      if (!row) {
        return reply.status(404).send({ code: "not_found", message: "Venue not found" });
      }
      return row;
    },
  );

  app.post(
    "/editorial/venues",
    {
      schema: {
        tags: ["shop-admin"],
        body: EditorialVenueWriteBodySchema,
        response: { 201: EditorialCreateResponseSchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const subject = adminSubject(request);
      const body = request.body as Parameters<typeof repo.createVenue>[0];
      const created = await repo.createVenue({ ...body, updatedBy: subject });
      return reply.status(201).send(created);
    },
  );

  app.put(
    "/editorial/venues/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        body: EditorialVenueUpdateBodySchema,
        response: { ...UpdateResponses, 403: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      const body = request.body as Omit<Parameters<typeof repo.updateVenue>[1], "updatedBy">;
      const outcome = await repo.updateVenue(id, { ...body, updatedBy: subject });
      return sendUpdateOutcome(request, reply, "Venue", outcome);
    },
  );

  app.post(
    "/editorial/venues/:id/publish",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.publish");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      await repo.setVenuePublication(id, true, subject);
      return reply.status(204).send();
    },
  );

  app.post(
    "/editorial/venues/:id/unpublish",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.publish");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      await repo.setVenuePublication(id, false, subject);
      return reply.status(204).send();
    },
  );

  app.get(
    "/editorial/stories/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 200: AdminStoryDetailSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const { id } = request.params as { id: string };
      const row = await repo.getAdminStoryById(id);
      if (!row) {
        return reply.status(404).send({ code: "not_found", message: "Story not found" });
      }
      return row;
    },
  );

  app.post(
    "/editorial/stories",
    {
      schema: {
        tags: ["shop-admin"],
        body: EditorialStoryWriteBodySchema,
        response: { 201: EditorialCreateResponseSchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const subject = adminSubject(request);
      const body = request.body as Omit<Parameters<typeof repo.createStory>[0], "updatedBy">;
      const created = await repo.createStory({ ...body, updatedBy: subject });
      return reply.status(201).send(created);
    },
  );

  app.put(
    "/editorial/stories/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        body: EditorialStoryUpdateBodySchema,
        response: { ...UpdateResponses, 403: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      const body = request.body as Omit<Parameters<typeof repo.updateStory>[1], "updatedBy">;
      const outcome = await repo.updateStory(id, { ...body, updatedBy: subject });
      return sendUpdateOutcome(request, reply, "Story", outcome);
    },
  );

  app.post(
    "/editorial/stories/:id/publish",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.publish");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      await repo.setStoryPublication(id, true, subject);
      return reply.status(204).send();
    },
  );

  app.post(
    "/editorial/stories/:id/unpublish",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.publish");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      await repo.setStoryPublication(id, false, subject);
      return reply.status(204).send();
    },
  );

  app.get(
    "/editorial/exhibitions/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 200: AdminExhibitionDetailSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const { id } = request.params as { id: string };
      const row = await repo.getAdminExhibitionById(id);
      if (!row) {
        return reply.status(404).send({ code: "not_found", message: "Exhibition not found" });
      }
      return row;
    },
  );

  app.post(
    "/editorial/exhibitions",
    {
      schema: {
        tags: ["shop-admin"],
        body: EditorialExhibitionWriteBodySchema,
        response: { 201: EditorialCreateResponseSchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const subject = adminSubject(request);
      const body = request.body as Omit<Parameters<typeof repo.createExhibition>[0], "updatedBy">;
      const created = await repo.createExhibition({ ...body, updatedBy: subject });
      return reply.status(201).send(created);
    },
  );

  app.put(
    "/editorial/exhibitions/:id",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        body: EditorialExhibitionUpdateBodySchema,
        response: { ...UpdateResponses, 403: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.write");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      const body = request.body as Omit<Parameters<typeof repo.updateExhibition>[1], "updatedBy">;
      const outcome = await repo.updateExhibition(id, { ...body, updatedBy: subject });
      return sendUpdateOutcome(request, reply, "Exhibition", outcome);
    },
  );

  app.post(
    "/editorial/exhibitions/:id/publish",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.publish");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      await repo.setExhibitionPublication(id, true, subject);
      return reply.status(204).send();
    },
  );

  app.post(
    "/editorial/exhibitions/:id/unpublish",
    {
      schema: {
        tags: ["shop-admin"],
        params: EditorialIdParamsSchema,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "editorial.publish");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      await repo.setExhibitionPublication(id, false, subject);
      return reply.status(204).send();
    },
  );

  app.post(
    "/editorial/preview-token",
    {
      schema: {
        tags: ["shop-admin"],
        body: PreviewTokenBodySchema,
        response: {
          200: PreviewTokenResponseSchema,
          403: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "editorial.write");
      const subject = adminSubject(request);
      const body = request.body as { entity: EditorialPreviewEntity; id: string };
      await repo.recordPreviewTokenIssued(body.entity, body.id, subject);
      const exp = Math.floor(Date.now() / 1000) + 15 * 60;
      const token = signEditorialPreviewToken(deps.previewSecret, {
        entity: body.entity,
        id: body.id,
        exp,
      });
      return { token, expiresAt: new Date(exp * 1000).toISOString() };
    },
  );
}
