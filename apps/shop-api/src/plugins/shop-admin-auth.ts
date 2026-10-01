import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER, type ProductScope } from "@auction/identity-contracts";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { type ShopStaffCapability, roleHasCapability } from "@auction/shop-domain";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ShopStaffMemberReader } from "../application/ports/staff-member.reader.js";
import { ShopApiError } from "../errors/shop-api-error.js";

export type ShopAdminAuthContext = {
  subject: string;
  scopes: readonly ProductScope[];
  role: import("@auction/shop-domain").ShopStaffRole;
  /** OIDC `auth_time` (seconds since epoch) when present on the access token. */
  authTime: number | undefined;
};

declare module "fastify" {
  interface FastifyRequest {
    shopAdminAuth?: ShopAdminAuthContext;
  }
}

function readAuthTime(payload: import("jose").JWTPayload): number | undefined {
  const raw = payload.auth_time;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

export function registerShopAdminAuthPlugin(
  app: FastifyInstance,
  options: {
    jwksUrl: string;
    issuer: string;
    staffReader: ShopStaffMemberReader;
  },
): void {
  app.decorateRequest("shopAdminAuth", undefined);
  app.addHook("onRequest", async (request) => {
    const path = request.url.split("?")[0] ?? request.url;
    if (!path.startsWith("/admin/v1/")) {
      return;
    }
    if (path === "/admin/v1/health/live" || path === "/admin/v1/health/ready") {
      return;
    }
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.UNAUTHORIZED, "Unauthorized", 401);
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
    if (!scopes.includes("shop.admin")) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Insufficient scope", 403);
    }
    const acr = verified.payload.acr;
    if (acr !== OIDC_ACR_SILVER) {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.STEP_UP_REQUIRED,
        "Silver MFA (step-up) required for staff admin",
        403,
      );
    }
    const staff = await options.staffReader.findActiveByIdentitySubject(verified.subject);
    if (!staff) {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.STAFF_REQUIRED,
        "Active shop staff membership required",
        403,
      );
    }
    request.shopAdminAuth = {
      subject: verified.subject,
      scopes,
      role: staff.role,
      authTime: readAuthTime(verified.payload),
    };
  });
}

export function requireShopStaffCapability(
  request: FastifyRequest,
  capability: ShopStaffCapability,
): ShopAdminAuthContext {
  const auth = request.shopAdminAuth;
  if (!auth) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.UNAUTHORIZED, "Unauthorized", 401);
  }
  if (!roleHasCapability(auth.role, capability)) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Insufficient capability", 403);
  }
  return auth;
}

export function requireShopAdminSubject(request: FastifyRequest): string {
  const auth = request.shopAdminAuth;
  if (!auth) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.UNAUTHORIZED, "Unauthorized", 401);
  }
  return auth.subject;
}

/** D31: finance mutations require a recent authentication (`auth_time`). */
export function requireRecentFinanceAuthentication(
  request: FastifyRequest,
  maxAuthAgeSeconds: number,
): void {
  const ctx = request.shopAdminAuth;
  if (!ctx) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.UNAUTHORIZED, "Unauthorized", 401);
  }
  const authTime = ctx.authTime;
  if (authTime == null) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.STEP_UP_REQUIRED,
      "Recent authentication is required for this action",
      403,
    );
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const age = nowSec - authTime;
  if (age < 0 || age > maxAuthAgeSeconds) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.STEP_UP_REQUIRED,
      "Recent authentication is required for this action",
      403,
    );
  }
}
