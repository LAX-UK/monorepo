import type { Hono } from "hono";
import type { ContainerSaleRoutesSlice } from "../../container.js";
import type { createOptionalAuth } from "../../middleware/optional-auth.js";
import type { createRequireAuth } from "../../middleware/require-auth.js";
import type { createRequireKyc } from "../../middleware/require-kyc.js";

export type SaleHono = Hono<{
  Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
}>;

export type SaleRouteDeps = {
  container: ContainerSaleRoutesSlice;
  requireAuth: ReturnType<typeof createRequireAuth>;
  optionalAuth: ReturnType<typeof createOptionalAuth>;
  kycGate: ReturnType<typeof createRequireKyc>;
};
