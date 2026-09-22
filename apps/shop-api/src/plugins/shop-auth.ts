import { timingSafeEqual } from "node:crypto";
import { verifyBearerToken } from "@auction/auth/token-verifier";
import type { ProductScope } from "@auction/identity-contracts";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ShopApiError } from "../errors/shop-api-error.js";

export type ShopAuthContext =
  | { kind: "user"; subject: string; scopes: readonly ProductScope[] }
  | { kind: "bff"; scopes: readonly ProductScope[] };

declare module "fastify" {
  interface FastifyRequest {
    shopAuth?: ShopAuthContext;
  }
}

export function registerShopAuthPlugin(
  app: FastifyInstance,
  options: { jwksUrl: string; issuer: string; bffToken?: string | undefined },
): void {
  app.decorateRequest("shopAuth", undefined);
  app.addHook("onRequest", async (request) => {
    if (request.url.startsWith("/webhooks/") || request.url.startsWith("/health")) {
      return;
    }
    const path = request.url.split("?")[0] ?? request.url;
    const protectedCommerce =
      path.startsWith("/v1/basket") ||
      path.startsWith("/v1/orders") ||
      /\/v1\/artworks\/[^/]+\/interest$/.test(path);
    if (!protectedCommerce) {
      return;
    }
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.UNAUTHORIZED, "Unauthorized", 401);
    }
    const token = header.slice("Bearer ".length);
    if (options.bffToken && constantTimeEqual(token, options.bffToken)) {
      request.shopAuth = { kind: "bff", scopes: ["shop.read", "shop.write"] };
      return;
    }
    const verified = await verifyBearerToken({
      authorization: header,
      jwksUrl: options.jwksUrl,
      issuer: options.issuer,
      audience: "lax-shop-api",
    });
    if (!verified) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.UNAUTHORIZED, "Unauthorized", 401);
    }
    const scopeClaim = verified.payload.scope;
    const scopes = (typeof scopeClaim === "string" ? scopeClaim : "")
      .split(/\s+/)
      .filter(Boolean) as ProductScope[];
    request.shopAuth = { kind: "user", subject: verified.subject, scopes };
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export function requireShopScope(request: FastifyRequest, scope: ProductScope): void {
  const auth = request.shopAuth;
  if (!auth?.scopes.includes(scope)) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Insufficient scope", 403);
  }
}

export function requireShopSubject(request: FastifyRequest): string {
  const auth = request.shopAuth;
  if (auth?.kind !== "user") {
    throw new ShopApiError(SHOP_API_ERROR_CODES.UNAUTHORIZED, "Unauthorized", 401);
  }
  return auth.subject;
}
