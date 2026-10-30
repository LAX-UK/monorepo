import { randomUUID } from "node:crypto";
import {
  EditorialArtistRelationsSchema,
  EditorialExhibitionDetailSchema,
  EditorialExhibitionStatusFilterSchema,
  EditorialExhibitionSummarySchema,
  EditorialHomeResponseSchema,
  EditorialPageDetailSchema,
  EditorialPageSummarySchema,
  EditorialStoryDetailSchema,
  type EditorialStoryListQuery,
  EditorialStoryListQuerySchema,
  EditorialStorySummarySchema,
  EditorialVenueDetailSchema,
  EditorialVenueSummarySchema,
  GeneralEnquiryCreatedSchema,
  PortalGeneralEnquiriesResponseSchema,
  RegisterGeneralEnquiryRequestSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import {
  type EditorialPreviewEntity,
  verifyEditorialPreviewToken,
} from "../../domain/editorial-preview-token.js";
import type { EditorialRoutesDeps } from "../../editorial-route-deps.js";
import { notFound } from "../../errors/shop-api-error.js";
import { requireShopScope, requireShopSubject } from "../../plugins/shop-auth.js";
import { type EnquiryContactBody, admitEnquiry } from "./enquiry-admission.js";

/**
 * Site-search term for the exhibitions and stories lists. With `q`, exhibitions match across
 * every status and `status` is ignored; stories still honour `kind`.
 */
const EditorialSearchQuerySchema = Type.String({ minLength: 1, maxLength: 120 });

export async function registerEditorialRoutes(app: FastifyInstance, deps: EditorialRoutesDeps) {
  app.get(
    "/v1/editorial/home",
    {
      schema: {
        tags: ["editorial"],
        response: { 200: EditorialHomeResponseSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async () => {
      const placements = await deps.editorial.getHomePlacements();
      return { placements };
    },
  );

  app.get(
    "/v1/editorial/venues",
    {
      schema: {
        tags: ["editorial"],
        response: {
          200: Type.Object({ items: Type.Array(EditorialVenueSummarySchema) }),
        },
      },
    },
    async () => ({ items: await deps.editorial.listVenues() }),
  );

  app.get(
    "/v1/editorial/venues/:slug",
    {
      schema: {
        tags: ["editorial"],
        params: Type.Object({ slug: Type.String() }),
        response: { 200: EditorialVenueDetailSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const venue = await deps.editorial.getVenueBySlug(slug);
      if (!venue) throw notFound("Venue not found");
      return venue;
    },
  );

  app.get(
    "/v1/editorial/exhibitions",
    {
      schema: {
        tags: ["editorial"],
        querystring: Type.Object({
          status: Type.Optional(EditorialExhibitionStatusFilterSchema),
          q: Type.Optional(EditorialSearchQuerySchema),
        }),
        response: {
          200: Type.Object({ items: Type.Array(EditorialExhibitionSummarySchema) }),
        },
      },
    },
    async (request) => {
      const query = request.query as { status?: "current" | "upcoming" | "past"; q?: string };
      if (query.q?.trim()) {
        return { items: await deps.search.searchExhibitions(query.q) };
      }
      const items = await deps.editorial.listExhibitions(query.status ?? "current");
      return { items };
    },
  );

  app.get(
    "/v1/editorial/exhibitions/:slug",
    {
      schema: {
        tags: ["editorial"],
        params: Type.Object({ slug: Type.String() }),
        response: { 200: EditorialExhibitionDetailSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const exhibition = await deps.editorial.getExhibitionBySlug(slug);
      if (!exhibition) throw notFound("Exhibition not found");
      return exhibition;
    },
  );

  app.get(
    "/v1/editorial/stories",
    {
      schema: {
        tags: ["editorial"],
        querystring: Type.Object({
          ...EditorialStoryListQuerySchema.properties,
          q: Type.Optional(EditorialSearchQuerySchema),
        }),
        response: {
          200: Type.Object({ items: Type.Array(EditorialStorySummarySchema) }),
        },
      },
    },
    async (request) => {
      const { q, ...filters } = request.query as EditorialStoryListQuery & { q?: string };
      if (q?.trim()) {
        return { items: await deps.search.searchStories(q, filters.kind) };
      }
      return { items: await deps.editorial.listStories(filters) };
    },
  );

  app.get(
    "/v1/editorial/stories/:slug",
    {
      schema: {
        tags: ["editorial"],
        params: Type.Object({ slug: Type.String() }),
        response: { 200: EditorialStoryDetailSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const story = await deps.editorial.getStoryBySlug(slug);
      if (!story) throw notFound("Story not found");
      return story;
    },
  );

  app.get(
    "/v1/editorial/artists/:slug",
    {
      schema: {
        tags: ["editorial"],
        params: Type.Object({ slug: Type.String() }),
        response: { 200: EditorialArtistRelationsSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const relations = await deps.editorial.getArtistRelations(slug);
      if (!relations) throw notFound("Artist not found");
      return relations;
    },
  );

  app.get(
    "/v1/editorial/pages",
    {
      schema: {
        tags: ["editorial"],
        response: {
          200: Type.Object({ items: Type.Array(EditorialPageSummarySchema) }),
        },
      },
    },
    async () => ({ items: await deps.editorial.listPages() }),
  );

  app.get(
    "/v1/editorial/pages/:slug",
    {
      schema: {
        tags: ["editorial"],
        params: Type.Object({ slug: Type.String() }),
        response: { 200: EditorialPageDetailSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      const { slug } = request.params as { slug: string };
      const page = await deps.editorial.getPageBySlug(slug);
      if (!page) throw notFound("Page not found");
      return page;
    },
  );

  app.get(
    "/v1/editorial/preview/:token",
    {
      schema: {
        tags: ["editorial"],
        params: Type.Object({ token: Type.String({ minLength: 10 }) }),
        response: { 200: Type.Unknown(), 404: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      const { token } = request.params as { token: string };
      const payload = verifyEditorialPreviewToken(deps.previewSecret, token);
      if (!payload) throw notFound("Preview not found or expired");
      const entity = await deps.editorial.getDraftEntityById(
        payload.entity as EditorialPreviewEntity,
        payload.id,
      );
      if (!entity) throw notFound("Preview content not found");
      return entity;
    },
  );

  app.get(
    "/v1/me/general-enquiries",
    {
      schema: {
        tags: ["editorial"],
        response: { 200: PortalGeneralEnquiriesResponseSchema, 401: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      const items = await deps.editorial.listGeneralEnquiriesForSubject(subject);
      return {
        items: items.map((row) => ({
          enquiryId: row.enquiryId,
          topic: row.topic,
          contextSlug: row.contextSlug,
          message: row.message,
          phone: row.phone,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    },
  );

  app.post(
    "/v1/me/general-enquiries",
    {
      schema: {
        tags: ["editorial"],
        body: RegisterGeneralEnquiryRequestSchema,
        response: {
          201: GeneralEnquiryCreatedSchema,
          400: ShopApiErrorBodySchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          429: ShopApiErrorBodySchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as EnquiryContactBody & {
        topic: "general" | "private_viewing" | "art_advisory" | "selling" | "exhibition";
        contextSlug?: string;
        message: string;
        phone?: string;
      };
      const admission = await admitEnquiry(request, reply, deps.enquiryRateLimiter, body);
      if (admission.kind === "honeypot") {
        return reply.status(201).send({ enquiryId: randomUUID() });
      }
      const result = await deps.editorial.insertGeneralEnquiry({
        sender: admission.sender,
        topic: body.topic,
        contextSlug: body.contextSlug?.trim() || null,
        message: body.message.trim(),
        phone: body.phone?.trim() || null,
      });
      return reply.status(201).send(result);
    },
  );
}
