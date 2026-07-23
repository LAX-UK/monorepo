import type { MiddlewareHandler } from "hono";
import type { Hono } from "hono";
import type { ContainerSubmissionRoutesSlice } from "../../container.js";
import type { createRequireAuth } from "../../middleware/require-auth.js";
import type { LegalEntityContext } from "../../middleware/require-legal-entity-context.js";
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
  return { legalEntityId: ctx.legalEntityId };
}
