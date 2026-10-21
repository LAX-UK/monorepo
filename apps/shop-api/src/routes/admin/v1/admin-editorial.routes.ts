import {
  AdminGeneralEnquiriesResponseSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  type EditorialPreviewEntity,
  signEditorialPreviewToken,
} from "../../../domain/editorial-preview-token.js";
import type { EditorialRoutesDeps } from "../../../editorial-route-deps.js";
import {
  requireShopAdminSubject,
  requireShopStaffCapability,
} from "../../../plugins/shop-admin-auth.js";
import {
  EditorialCreateResponseSchema,
  EditorialExhibitionWriteBodySchema,
  EditorialIdParamsSchema,
  EditorialPageWriteBodySchema,
  EditorialPlacementItemSchema,
  EditorialPlacementSlotParamSchema,
  EditorialStoryWriteBodySchema,
  EditorialVenueWriteBodySchema,
} from "./editorial-admin-schemas.js";

const PreviewTokenBodySchema = Type.Object({
  entity: Type.Union([
    Type.Literal("venue"),
    Type.Literal("exhibition"),
    Type.Literal("story"),
    Type.Literal("page"),
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
});

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
  }),
]);

const AdminStoryDetailSchema = Type.Intersect([
  AdminRowSchema,
  AdminSeoFieldsSchema,
  Type.Object({
    kind: Type.Union([
      Type.Literal("article"),
      Type.Literal("film"),
      Type.Literal("press"),
      Type.Literal("guide"),
    ]),
    title: Type.String(),
    standfirst: Type.Union([Type.String(), Type.Null()]),
    coverMediaKey: Type.Union([Type.String(), Type.Null()]),
    videoUrl: Type.Union([Type.String(), Type.Null()]),
    featured: Type.Boolean(),
    body: Type.Array(Type.Unknown()),
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
  publishedAt: Type.Union([Type.String(), Type.Null()]),
});

function adminSubject(request: FastifyRequest): string {
  return requireShopAdminSubject(request);
}

export async function registerAdminEditorialRoutes(
  app: FastifyInstance,
  deps: EditorialRoutesDeps,
) {
  const repo = deps.editorial;

  app.get(
    "/general-enquiries",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: AdminGeneralEnquiriesResponseSchema },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "audit.read");
      const items = await repo.listAdminGeneralEnquiries({ limit: 100 });
      return {
        items: items.map((row) => ({
          enquiryId: row.enquiryId,
          identitySubjectId: row.identitySubjectId,
          contactName: row.contactName,
          contactEmail: row.contactEmail,
          topic: row.topic,
          contextSlug: row.contextSlug,
          message: row.message,
          phone: row.phone,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    },
  );

  app.get(
    "/editorial/venues",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: Type.Object({ items: Type.Array(AdminRowSchema) }) },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      return { items: await repo.listAdminVenues() };
    },
  );

  app.get(
    "/editorial/exhibitions",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: Type.Object({ items: Type.Array(AdminRowSchema) }) },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
      return { items: await repo.listAdminExhibitions() };
    },
  );

  app.get(
    "/editorial/stories",
    {
      schema: {
        tags: ["shop-admin"],
        response: { 200: Type.Object({ items: Type.Array(AdminRowSchema) }) },
      },
    },
    async (request) => {
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
        body: EditorialPageWriteBodySchema,
        response: { 204: Type.Null(), 403: ShopApiErrorBodySchema },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "catalogue.write");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      const body = request.body as Omit<Parameters<typeof repo.updatePage>[1], "updatedBy">;
      await repo.updatePage(id, { ...body, updatedBy: subject });
      return reply.status(204).send();
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
        body: EditorialVenueWriteBodySchema,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "catalogue.write");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      const body = request.body as Omit<Parameters<typeof repo.updateVenue>[1], "updatedBy">;
      await repo.updateVenue(id, { ...body, updatedBy: subject });
      return reply.status(204).send();
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
        body: EditorialStoryWriteBodySchema,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "catalogue.write");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      const body = request.body as Omit<Parameters<typeof repo.updateStory>[1], "updatedBy">;
      await repo.updateStory(id, { ...body, updatedBy: subject });
      return reply.status(204).send();
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
        body: EditorialExhibitionWriteBodySchema,
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      requireShopStaffCapability(request, "catalogue.write");
      const subject = adminSubject(request);
      const { id } = request.params as { id: string };
      const body = request.body as Omit<Parameters<typeof repo.updateExhibition>[1], "updatedBy">;
      await repo.updateExhibition(id, { ...body, updatedBy: subject });
      return reply.status(204).send();
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
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
      requireShopStaffCapability(request, "catalogue.write");
      requireShopAdminSubject(request);
      const body = request.body as { entity: EditorialPreviewEntity; id: string };
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
