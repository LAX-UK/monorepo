import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Container } from "../container.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { createRequireKyc } from "../middleware/require-kyc.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createBidUserRateLimitMiddleware } from "./bids.js";
import type { LotRouteDeps } from "./lots/_shared.js";
import { attachLotBiddingRoutes } from "./lots/bidding.routes.js";
import { attachLotCatalogRoutes } from "./lots/catalog.routes.js";
import { attachLotDetailRoutes } from "./lots/detail.routes.js";
import { attachLotLifecycleRoutes } from "./lots/lifecycle.routes.js";

export function createLotRoutes(container: Container, authenticator: IAuthenticator) {
  const biddingKillSwitch = createMiddleware(async (c, next) => {
    if (container.env?.DISABLE_BIDDING) {
      return c.json({ error: "Bidding temporarily disabled", code: "bidding_disabled" }, 503);
    }
    await next();
  });
  const bidUserRateLimit = createBidUserRateLimitMiddleware(container.redis);
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const optionalAuth = createOptionalAuth(authenticator);
  const kyc = container.kycService;
  const kycGate =
    kyc?.isConfigured() === true
      ? createRequireKyc(kyc)
      : createMiddleware<{ Variables: { userId?: string } }>(async (_c, next) => {
          await next();
        });
  const requireLegalEntity = container.requireSubmissionsLegalEntityContext;
  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRole?: string | null;
      legalEntityContext?: { legalEntityId: string };
    };
  }>();

  const deps: LotRouteDeps = {
    container,
    requireAuth,
    optionalAuth,
    kycGate,
    biddingKillSwitch,
    bidUserRateLimit,
    requireLegalEntity,
  };

  // Registration order mirrors the original monolith:
  // catalog reads → lifecycle mutations → buyer bidding actions → lot detail reads
  attachLotCatalogRoutes(r, deps);
  attachLotLifecycleRoutes(r, deps);
  attachLotBiddingRoutes(r, deps);
  attachLotDetailRoutes(r, deps);

  return r;
}
