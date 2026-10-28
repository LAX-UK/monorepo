import {
  PortalArtistArtworksResponseSchema,
  PortalArtistSalesResponseSchema,
  PortalCollectionResponseSchema,
  PortalDocumentsResponseSchema,
  PortalEditionsResponseSchema,
  PortalEnquiriesResponseSchema,
  PortalPayoutsResponseSchema,
  PortalSaleAuthorityRequestsResponseSchema,
  PortalSaleAuthorityResponseSchema,
  PortalSalesResponseSchema,
  PortalSellerAccessSchema,
  SaleAuthorityRequestBodySchema,
  SaleAuthorityRequestResponseSchema,
  SaleAuthorityRequestWithdrawResponseSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { decidePortalSellerAccess } from "../../domain/portal-seller-access.js";
import {
  SELLER_READ_SCOPES,
  SELLER_WRITE_SCOPES,
  requireAnyShopScope,
  requireShopScope,
  requireShopSubject,
} from "../../plugins/shop-auth.js";
import type { PortalRoutesDeps } from "../../portal-route-deps.js";

export type PortalMeRoutesDeps = PortalRoutesDeps & {
  payoutsEnabled: boolean;
};

export async function registerPortalMeRoutes(app: FastifyInstance, deps: PortalMeRoutesDeps) {
  app.get(
    "/v1/me/collection",
    {
      schema: {
        tags: ["shop-portal"],
        response: { 200: PortalCollectionResponseSchema, 401: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      const items = await deps.portalOwnership.listCollection(subject);
      return { items };
    },
  );

  app.get(
    "/v1/me/enquiries",
    {
      schema: {
        tags: ["shop-portal"],
        response: { 200: PortalEnquiriesResponseSchema, 401: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const subject = requireShopSubject(request);
      const items = await deps.portalOwnership.listEnquiries(subject);
      return { items };
    },
  );

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
      requireAnyShopScope(request, SELLER_READ_SCOPES);
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
      requireAnyShopScope(request, SELLER_READ_SCOPES);
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
      requireAnyShopScope(request, SELLER_WRITE_SCOPES);
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

  app.post(
    "/v1/me/sale-authority-requests/:requestId/withdraw",
    {
      schema: {
        tags: ["shop-portal"],
        params: Type.Object({ requestId: Type.String({ format: "uuid" }) }),
        response: {
          200: SaleAuthorityRequestWithdrawResponseSchema,
          400: ShopApiErrorBodySchema,
          401: ShopApiErrorBodySchema,
          403: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireAnyShopScope(request, SELLER_WRITE_SCOPES);
      const subject = requireShopSubject(request);
      const { requestId } = request.params as { requestId: string };
      return deps.portalOwnership.withdrawSaleAuthorityRequest(subject, requestId);
    },
  );

  // Answers about the caller only, so Account can show seller tools to people who can use them.
  app.get(
    "/v1/me/seller-access",
    {
      schema: {
        tags: ["shop-portal"],
        response: { 200: PortalSellerAccessSchema, 401: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireAnyShopScope(request, SELLER_READ_SCOPES);
      const subject = requireShopSubject(request);
      const [saleAuthority, requests, artist, payouts, sales, applied] = await Promise.all([
        deps.portalOwnership.listSaleAuthority(subject),
        deps.portalOwnership.listSaleAuthorityRequests(subject),
        deps.portalArtist.getLinkedArtist(subject),
        deps.payoutsEnabled ? deps.portalOwnership.listPayouts(subject) : [],
        deps.payoutsEnabled ? deps.portalSales.listSales(subject) : [],
        deps.artistApplications.hasApplication(subject),
      ]);
      return decidePortalSellerAccess({
        saleAuthority,
        hasSaleAuthorityRequest: requests.length > 0,
        hasPayout: payouts.length > 0,
        hasSalesStatement: sales.length > 0,
        hasLinkedArtist: artist !== null,
        hasArtistApplication: applied,
        payoutsEnabled: deps.payoutsEnabled,
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
      requireAnyShopScope(request, SELLER_READ_SCOPES);
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
      requireAnyShopScope(request, SELLER_READ_SCOPES);
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
        requireAnyShopScope(request, SELLER_READ_SCOPES);
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
        requireAnyShopScope(request, SELLER_READ_SCOPES);
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
