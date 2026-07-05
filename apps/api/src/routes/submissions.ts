import { Hono } from "hono";
import type { ContainerSubmissionRoutesSlice } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { SubmissionRouteDeps } from "./submissions/_shared.js";
import { attachSubmissionAdminRoutes } from "./submissions/admin.routes.js";
import { attachSubmissionSellerRoutes } from "./submissions/seller.routes.js";

export function createSubmissionRoutes(
  container: ContainerSubmissionRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  const requireSubmissionEntityContext = container.requireSubmissionsLegalEntityContext;
  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRole?: string | null;
      legalEntityContext?: LegalEntityContext;
    };
  }>();

  const deps: SubmissionRouteDeps = {
    container,
    requireAuth,
    requireSubmissionEntityContext,
  };

  attachSubmissionSellerRoutes(r, deps);
  attachSubmissionAdminRoutes(r, deps);

  return r;
}
