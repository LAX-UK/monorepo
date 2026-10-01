import { ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type { PortalRoutesDeps } from "../../portal-route-deps.js";

export type PortalMeRoutesDeps = PortalRoutesDeps & {
  payoutsEnabled: boolean;
};
import { requireShopScope, requireShopSubject } from "../../plugins/shop-auth.js";

const PortalEditionSchema = Type.Object({
  editionId: Type.String({ format: "uuid" }),
  artworkId: Type.String({ format: "uuid" }),
  artworkSlug: Type.String(),
  artworkTitle: Type.String(),
  editionNumber: Type.Integer(),
  listingStatus: Type.String(),
  custodyStatus: Type.String(),
});

const PortalEditionsResponseSchema = Type.Object({
  items: Type.Array(PortalEditionSchema),
});

const PortalSaleAuthoritySchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  artworkSlug: Type.String(),
  artworkTitle: Type.String(),
  ownerPartyId: Type.String({ format: "uuid" }),
  authorisedCount: Type.Integer(),
  committedCount: Type.Integer(),
  lastGrantAt: Type.Union([Type.String(), Type.Null()]),
});

const PortalSaleAuthorityResponseSchema = Type.Object({
  items: Type.Array(PortalSaleAuthoritySchema),
});

const SaleAuthorityRequestBodySchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  requestedCount: Type.Integer({ minimum: 0, maximum: 10 }),
  note: Type.Optional(Type.String()),
});

const SaleAuthorityRequestResponseSchema = Type.Object({
  requestId: Type.String({ format: "uuid" }),
  status: Type.Literal("pending"),
});

const PortalPayoutSchema = Type.Object({
  payoutId: Type.String({ format: "uuid" }),
  grossPence: Type.Integer(),
  deductionsPence: Type.Integer(),
  netPence: Type.Integer(),
  status: Type.String(),
  payoutDueAt: Type.String(),
  paidAt: Type.Union([Type.String(), Type.Null()]),
});

const PortalPayoutsResponseSchema = Type.Object({
  items: Type.Array(PortalPayoutSchema),
});

const PortalDocumentSchema = Type.Object({
  documentId: Type.String({ format: "uuid" }),
  kind: Type.String(),
  createdAt: Type.String(),
  downloadUrl: Type.Union([Type.String(), Type.Null()]),
});

const PortalDocumentsResponseSchema = Type.Object({
  items: Type.Array(PortalDocumentSchema),
});

export async function registerPortalMeRoutes(app: FastifyInstance, deps: PortalMeRoutesDeps) {
  app.get(
    "/v1/me/editions",
    {
      schema: {
        tags: ["shop-portal"],
        response: { 200: PortalEditionsResponseSchema, 401: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      const items = await deps.portalOwnership.listOwnedEditions(subject);
      return { items };
    },
  );

  app.get(
    "/v1/me/sale-authority",
    {
      schema: {
        tags: ["shop-portal"],
        response: { 200: PortalSaleAuthorityResponseSchema, 401: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      const items = await deps.portalOwnership.listSaleAuthority(subject);
      return { items };
    },
  );

  app.post(
    "/v1/me/sale-authority-requests",
    {
      schema: {
        tags: ["shop-portal"],
        body: SaleAuthorityRequestBodySchema,
        response: {
          200: SaleAuthorityRequestResponseSchema,
          400: ShopApiErrorBodySchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const subject = requireShopSubject(request);
      const body = request.body as {
        artworkId: string;
        requestedCount: number;
        note?: string;
      };
      return deps.portalOwnership.createSaleAuthorityRequest({
        identitySubjectId: subject,
        artworkId: body.artworkId,
        requestedCount: body.requestedCount,
        ...(body.note !== undefined ? { note: body.note } : {}),
      });
    },
  );

  if (deps.payoutsEnabled) {
    app.get(
      "/v1/me/payouts",
      {
        schema: {
          tags: ["shop-portal"],
          response: { 200: PortalPayoutsResponseSchema, 401: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        requireShopScope(request, "shop.read");
        const subject = requireShopSubject(request);
        const items = await deps.portalOwnership.listPayouts(subject);
        return { items };
      },
    );

    app.get(
      "/v1/me/documents",
      {
        schema: {
          tags: ["shop-portal"],
          response: { 200: PortalDocumentsResponseSchema, 401: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        requireShopScope(request, "shop.read");
        const subject = requireShopSubject(request);
        const items = await deps.portalOwnership.listDocuments(subject);
        return { items };
      },
    );
  }
}
