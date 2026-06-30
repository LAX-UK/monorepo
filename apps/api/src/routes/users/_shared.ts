import type { Hono } from "hono";
import type { Container } from "../../container.js";
import type { MarketingClientContextVars } from "../../middleware/marketing-client-context.js";
import type { MarketingConsentVars } from "../../middleware/marketing-consent.js";
import type { createRequireAuth } from "../../middleware/require-auth.js";
import type { createRequireRecentPasswordAuth } from "../../middleware/require-recent-password-auth.js";
import type { createTurnstileMiddleware } from "../../middleware/turnstile.js";

export type UserHono = Hono<{
  Variables: { userId?: string; userRole?: string } & MarketingConsentVars &
    MarketingClientContextVars;
}>;

export type UserRouteDeps = {
  container: Container;
  requireAuth: ReturnType<typeof createRequireAuth>;
  requireAuthAllowSuspended: ReturnType<typeof createRequireAuth>;
  requirePasswordStepUp: ReturnType<typeof createRequireRecentPasswordAuth>;
  requireSessionRevokeAuth: ReturnType<typeof createRequireRecentPasswordAuth>;
  requireTurnstile: ReturnType<typeof createTurnstileMiddleware>;
};
