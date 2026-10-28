import type { MiddlewareHandler } from "hono";
import type { Hono } from "hono";
import type { ContainerSubmissionRoutesSlice } from "../../container.js";
import type { createRequireAuth } from "../../middleware/require-auth.js";
import type { LegalEntityContext } from "../../middleware/require-legal-entity-context.js";
import type { AgreementSellerContext } from "../../services/interfaces/submission-routes/consignment-agreement-http.js";
import type {
  SubmissionLegalEntityContext,
  SubmissionViewerContext,
} from "../../services/interfaces/submission-routes/submission-route-http.js";

export type SubmissionHono = Hono<{
  Variables: {
    userId?: string;
    userRole?: string;
    userStaffRole?: string | null;
    legalEntityContext?: LegalEntityContext;
  };
}>;

export type SubmissionRouteDeps = {
  container: ContainerSubmissionRoutesSlice;
  requireAuth: ReturnType<typeof createRequireAuth>;
  requireSubmissionEntityContext: MiddlewareHandler;
  requireAccountOnboarding: MiddlewareHandler;
};

export function viewerFromContext(c: {
  get: (key: "userId" | "userRole" | "userStaffRole") => string | null | undefined;
}): SubmissionViewerContext {
  return {
    userId: c.get("userId") as string,
    role: c.get("userRole"),
    staffRole: c.get("userStaffRole") ?? null,
  };
}

export function legalEntityFromContext(c: {
  get: (key: "legalEntityContext") => LegalEntityContext | undefined;
}): SubmissionLegalEntityContext {
  const ctx = c.get("legalEntityContext") as LegalEntityContext;
  return {
    legalEntityId: ctx.legalEntityId,
    member: { userId: ctx.userId, actor: { role: ctx.role, isImpersonation: ctx.isImpersonation } },
  };
}

/** The signed-in person, the account they act for and their standing with it. */
export function agreementSellerFromContext(c: {
  get: ((key: "legalEntityContext") => LegalEntityContext | undefined) &
    ((key: "userId") => string | undefined);
}): AgreementSellerContext {
  const ctx = c.get("legalEntityContext") as LegalEntityContext;
  return {
    userId: c.get("userId") as string,
    legalEntityId: ctx.legalEntityId,
    actor: { role: ctx.role, isImpersonation: ctx.isImpersonation },
  };
}
