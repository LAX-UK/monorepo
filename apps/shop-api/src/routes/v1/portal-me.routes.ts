import {
  PortalArtistArtworksResponseSchema,
  PortalArtistSalesResponseSchema,
  PortalDocumentsResponseSchema,
  PortalEditionsResponseSchema,
  PortalPayoutsResponseSchema,
  PortalSaleAuthorityRequestsResponseSchema,
  PortalSaleAuthorityResponseSchema,
  PortalSalesResponseSchema,
  SaleAuthorityRequestBodySchema,
  SaleAuthorityRequestResponseSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import type { FastifyInstance } from "fastify";
import { requireShopScope, requireShopSubject } from "../../plugins/shop-auth.js";
import type { PortalRoutesDeps } from "../../portal-route-deps.js";

export type PortalMeRoutesDeps = PortalRoutesDeps & {
  payoutsEnabled: boolean;
};

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

  app.get(
    "/v1/me/sale-authority-requests",
    {
      schema: {
        tags: ["shop-portal"],
        response: {
          200: PortalSaleAuthorityRequestsResponseSchema,
          401: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      const items = await deps.portalOwnership.listSaleAuthorityRequests(subject);
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
          409: ShopApiErrorBodySchema,
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

  app.get(
    "/v1/me/artist/artworks",
    {
      schema: {
        tags: ["shop-portal"],
        response: { 200: PortalArtistArtworksResponseSchema, 401: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      const artist = await deps.portalArtist.getLinkedArtist(subject);
      const items = await deps.portalArtist.listArtworks(subject);
      return { artist, items };
    },
  );

  app.get(
    "/v1/me/artist/sales",
    {
      schema: {
        tags: ["shop-portal"],
        response: { 200: PortalArtistSalesResponseSchema, 401: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      const artist = await deps.portalArtist.getLinkedArtist(subject);
      const items = await deps.portalArtist.listSales(subject);
      return { artist, items };
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
      "/v1/me/sales",
      {
        schema: {
          tags: ["shop-portal"],
          response: { 200: PortalSalesResponseSchema, 401: ShopApiErrorBodySchema },
        },
      },
      async (request) => {
        requireShopScope(request, "shop.read");
        const subject = requireShopSubject(request);
        const items = await deps.portalSales.listSales(subject);
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
