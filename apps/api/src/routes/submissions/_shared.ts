import type { MiddlewareHandler } from "hono";
import type { Hono } from "hono";
import type { Container } from "../../container.js";
import type { createRequireAuth } from "../../middleware/require-auth.js";
import type { LegalEntityContext } from "../../middleware/require-legal-entity-context.js";

export type SubmissionHono = Hono<{
  Variables: {
    userId?: string;
    userRole?: string;
    userStaffRole?: string | null;
    legalEntityContext?: LegalEntityContext;
  };
}>;

export type SubmissionRouteDeps = {
  container: Container;
  requireAuth: ReturnType<typeof createRequireAuth>;
  requireSubmissionEntityContext: MiddlewareHandler;
};
