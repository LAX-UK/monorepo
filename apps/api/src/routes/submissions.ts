import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import type { ContainerSubmissionRoutesSlice } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { SubmissionRouteDeps } from "./submissions/_shared.js";
import { attachSubmissionAdminRoutes } from "./submissions/admin.routes.js";
import { attachSubmissionAfterSaleRoutes } from "./submissions/after-sale.routes.js";
import { attachConsignmentMessageRoutes } from "./submissions/messages.routes.js";
import { attachSubmissionSellerRoutes } from "./submissions/seller.routes.js";

export function createSubmissionRoutes(
  container: ContainerSubmissionRoutesSlice,
  authenticator: IAuthenticator,
  requireAccountOnboarding: MiddlewareHandler,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  const requireSubmissionEntityContext = container.requireSubmissionsLegalEntityContext;
  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRoles?: StaffRoles | undefined;
      legalEntityContext?: LegalEntityContext;
    };
  }>();

  const deps: SubmissionRouteDeps = {
    container,
    requireAuth,
    requireSubmissionEntityContext,
    requireAccountOnboarding,
  };

  attachSubmissionSellerRoutes(r, deps);
  attachSubmissionAdminRoutes(r, deps);
  attachSubmissionAfterSaleRoutes(r, deps);
  attachConsignmentMessageRoutes(r, deps);

  return r;
}
