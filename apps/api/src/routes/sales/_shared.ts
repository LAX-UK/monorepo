import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type {
  ContainerSaleAuxRoutesSlice,
  ContainerSaleFollowRoutesSlice,
  ContainerSaleLifecycleWriteRoutesSlice,
  ContainerSaleLotMembershipRoutesSlice,
  ContainerSaleReadRoutesSlice,
  ContainerSaleRoutesSlice,
} from "../../container.js";
import type { createOptionalAuth } from "../../middleware/optional-auth.js";
import type { createRequireAuth } from "../../middleware/require-auth.js";
import type { createRequireKyc } from "../../middleware/require-kyc.js";

export type SaleHono = Hono<{
  Variables: {
    userId?: string;
    userRole?: string;
    userStaffRole?: string | null;
    legalEntityContext?: { legalEntityId: string };
  };
}>;

type SaleRouteMiddleware = {
  requireAuth: ReturnType<typeof createRequireAuth>;
  optionalAuth: ReturnType<typeof createOptionalAuth>;
  kycGate: ReturnType<typeof createRequireKyc>;
  requireLegalEntity: MiddlewareHandler;
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

export type SaleFollowRouteDeps = SaleRouteMiddleware & {
  container: ContainerSaleFollowRoutesSlice;
};

export type SaleAuxRouteDeps = SaleRouteMiddleware & {
  container: ContainerSaleAuxRoutesSlice;
};
