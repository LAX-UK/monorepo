import type { Hono } from "hono";
import type {
  ContainerSaleAuxRoutesSlice,
  ContainerSaleLifecycleWriteRoutesSlice,
  ContainerSaleLotMembershipRoutesSlice,
  ContainerSaleReadRoutesSlice,
  ContainerSaleRoutesSlice,
} from "../../container.js";
import type { createOptionalAuth } from "../../middleware/optional-auth.js";
import type { createRequireAuth } from "../../middleware/require-auth.js";
import type { createRequireKyc } from "../../middleware/require-kyc.js";

export type SaleHono = Hono<{
  Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
}>;

type SaleRouteMiddleware = {
  requireAuth: ReturnType<typeof createRequireAuth>;
  optionalAuth: ReturnType<typeof createOptionalAuth>;
  kycGate: ReturnType<typeof createRequireKyc>;
};

export type SaleRouteDeps = SaleRouteMiddleware & {
  container: ContainerSaleRoutesSlice;
};

export type SaleReadRouteDeps = SaleRouteMiddleware & {
  container: ContainerSaleReadRoutesSlice;
};

export type SaleLifecycleWriteRouteDeps = SaleRouteMiddleware & {
  container: ContainerSaleLifecycleWriteRoutesSlice;
};

export type SaleLotMembershipRouteDeps = SaleRouteMiddleware & {
  container: ContainerSaleLotMembershipRoutesSlice;
};

export type SaleAuxRouteDeps = SaleRouteMiddleware & {
  container: ContainerSaleAuxRoutesSlice;
};
