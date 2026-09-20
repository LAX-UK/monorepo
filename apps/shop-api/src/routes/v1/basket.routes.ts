import { createHash } from "node:crypto";
import { BasketViewSchema, ShopApiErrorBodySchema } from "@auction/shop-contracts";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { Type } from "@sinclair/typebox";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { BasketOwner } from "../../application/ports/commerce.ports.js";
import type { CommerceRoutesDeps } from "../../commerce-route-deps.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import {
  type ShopAuthContext,
  requireShopScope,
  requireShopSubject,
} from "../../plugins/shop-auth.js";
import { presentBasket } from "../../presenters/commerce.presenter.js";

const ANON_HEADER = "x-shop-basket-token";

function hashBasketToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function resolveBasketOwner(request: FastifyRequest): BasketOwner {
  const auth = request.shopAuth;
  if (auth?.kind === "user") {
    return { kind: "subject", identitySubjectId: auth.subject };
  }
  const raw = request.headers[ANON_HEADER];
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    throw notFound("Basket");
  }
  if (auth?.kind !== "bff") {
    throw new ShopApiError(SHOP_API_ERROR_CODES.UNAUTHORIZED, "Unauthorized", 401);
  }
  return { kind: "anonymous", tokenHash: hashBasketToken(token) };
}

export async function registerBasketRoutes(app: FastifyInstance, deps: CommerceRoutesDeps) {
  app.get(
    "/v1/basket",
    {
      schema: {
        tags: ["commerce"],
        response: { 200: BasketViewSchema, 404: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.read");
      const owner = resolveBasketOwner(request);
      const basket = await deps.getBasket(owner);
      if (!basket) {
        throw notFound("Basket");
      }
      return presentBasket(basket);
    },
  );

  app.put(
    "/v1/basket/lines",
    {
      schema: {
        tags: ["commerce"],
        body: Type.Object({
          artworkSlug: Type.String({ minLength: 1 }),
          quantity: Type.Integer({ minimum: 1, maximum: 24 }),
        }),
        response: {
          200: BasketViewSchema,
          400: ShopApiErrorBodySchema,
          409: ShopApiErrorBodySchema,
        },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const body = request.body as { artworkSlug: string; quantity: number };
      const basket = await deps.upsertBasketLine({
        owner: resolveBasketOwner(request),
        artworkSlug: body.artworkSlug,
        quantity: body.quantity,
      });
      return presentBasket(basket);
    },
  );

  app.delete(
    "/v1/basket/lines/:lineId",
    {
      schema: {
        tags: ["commerce"],
        params: Type.Object({ lineId: Type.String({ format: "uuid" }) }),
        response: { 200: BasketViewSchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const { lineId } = request.params as { lineId: string };
      const basket = await deps.removeBasketLine({
        owner: resolveBasketOwner(request),
        lineId,
      });
      return presentBasket(basket);
    },
  );

  app.post(
    "/v1/basket/merge",
    {
      schema: {
        tags: ["commerce"],
        body: Type.Object({
          fromToken: Type.String({ minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9_-]+$" }),
        }),
        response: { 200: BasketViewSchema, 409: ShopApiErrorBodySchema },
      },
    },
    async (request) => {
      requireShopScope(request, "shop.write");
      const subject = requireShopSubject(request);
      const body = request.body as { fromToken: string };
      const basket = await deps.mergeBaskets({
        from: { kind: "anonymous", tokenHash: hashBasketToken(body.fromToken) },
        to: { kind: "subject", identitySubjectId: subject },
      });
      return presentBasket(basket);
    },
  );
}

export type { ShopAuthContext };
