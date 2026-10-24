import {
  PortalPayeeConnectSessionBodySchema as AccountSessionBodySchema,
  PortalPayeeConnectConfigSchema as ConnectClientConfigSchema,
  PortalPayeeConnectStatusSchema as ConnectStatusSchema,
  PortalPayeeConnectSessionResponseSchema,
  ShopApiErrorBodySchema,
} from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import type {
  ShopPayeeConnectPort,
  ShopPayeeConnectSessionSurface,
} from "../../application/ports/shop-payee-connect.port.js";
import {
  SELLER_READ_SCOPES,
  SELLER_WRITE_SCOPES,
  requireAnyShopScope,
  requireShopScope,
  requireShopSubject,
} from "../../plugins/shop-auth.js";

const ConnectLinkBodySchema = Type.Object({
  returnUrl: Type.String({ format: "uri" }),
  refreshUrl: Type.String({ format: "uri" }),
});

const ConnectLinkResponseSchema = Type.Object({
  url: Type.String(),
  expiresAt: Type.String({ format: "date-time" }),
});

const errorResponses = {
  400: ShopApiErrorBodySchema,
  401: ShopApiErrorBodySchema,
  404: ShopApiErrorBodySchema,
  409: ShopApiErrorBodySchema,
  501: ShopApiErrorBodySchema,
  502: ShopApiErrorBodySchema,
};

export async function registerPortalConnectRoutes(
  app: FastifyInstance,
  connect: ShopPayeeConnectPort,
) {
  app.get(
    "/v1/me/connect/config",
    {
      schema: {
        tags: ["shop-portal"],
        response: { 200: ConnectClientConfigSchema, 401: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireAnyShopScope(request, SELLER_READ_SCOPES);
      requireShopSubject(request);
      return connect.getClientConfig();
    },
  );

  app.get(
    "/v1/me/connect/status",
    {
      schema: {
        tags: ["shop-portal"],
        response: {
          200: ConnectStatusSchema,
          401: ShopApiErrorBodySchema,
          404: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireAnyShopScope(request, SELLER_READ_SCOPES);
      const subject = requireShopSubject(request);
      return connect.getStatusForSubject(subject);
    },
  );

  app.post(
    "/v1/me/connect/account",
    {
      schema: {
        tags: ["shop-portal"],
        response: { 200: Type.Object({ stripeAccountId: Type.String() }), ...errorResponses },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const subject = requireShopSubject(request);
      return connect.ensureAccountForSubject(subject);
    },
  );

  app.post(
    "/v1/me/connect/account-session",
    {
      schema: {
        tags: ["shop-portal"],
        body: AccountSessionBodySchema,
        response: { 200: PortalPayeeConnectSessionResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      requireAnyShopScope(request, SELLER_WRITE_SCOPES);
      const subject = requireShopSubject(request);
      const body = request.body as { surface: ShopPayeeConnectSessionSurface };
      return connect.createAccountSessionForSubject(subject, body.surface);
    },
  );

  app.post(
    "/v1/me/connect/onboarding-link",
    {
      schema: {
        tags: ["shop-portal"],
        body: ConnectLinkBodySchema,
        response: { 200: ConnectLinkResponseSchema, ...errorResponses },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const subject = requireShopSubject(request);
      const body = request.body as { returnUrl: string; refreshUrl: string };
      return connect.createOnboardingLinkForSubject(subject, body.returnUrl, body.refreshUrl);
    },
  );
}
