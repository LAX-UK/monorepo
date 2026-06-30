import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Container } from "../container.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { createRequireKyc } from "../middleware/require-kyc.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { SaleRouteDeps } from "./sales/_shared.js";
import { attachSaleFollowRoutes } from "./sales/follow.routes.js";
import { attachSaleLifecycleRoutes } from "./sales/lifecycle.routes.js";
import { attachSaleLotsRoutes } from "./sales/lots.routes.js";
import { attachSaleReadRoutes } from "./sales/read.routes.js";
import { attachSaleRegistrationRoutes } from "./sales/registration.routes.js";

export function createSaleRoutes(container: Container, authenticator: IAuthenticator) {
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
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  const deps: SaleRouteDeps = {
    container,
    requireAuth,
    optionalAuth,
    kycGate,
  };

  attachSaleReadRoutes(r, deps);
  attachSaleRegistrationRoutes(r, deps);
  attachSaleFollowRoutes(r, deps);
  attachSaleLifecycleRoutes(r, deps);
  attachSaleLotsRoutes(r, deps);

  return r;
}
