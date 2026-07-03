import type { MiddlewareHandler } from "hono";
import type { Hono } from "hono";
import type { ContainerLotRouteDepsSlice } from "../../container.js";
import type { createOptionalAuth } from "../../middleware/optional-auth.js";
import type { createRequireAuth } from "../../middleware/require-auth.js";
import type { createRequireKyc } from "../../middleware/require-kyc.js";

export type LotHono = Hono<{
  Variables: {
    userId?: string;
    userRole?: string;
    userStaffRole?: string | null;
    legalEntityContext?: { legalEntityId: string };
  };
}>;

export type LotRouteDeps = {
  container: ContainerLotRouteDepsSlice;
  requireAuth: ReturnType<typeof createRequireAuth>;
  optionalAuth: ReturnType<typeof createOptionalAuth>;
  kycGate: ReturnType<typeof createRequireKyc>;
  biddingKillSwitch: MiddlewareHandler;
  bidUserRateLimit: MiddlewareHandler;
  requireLegalEntity: MiddlewareHandler;
};
