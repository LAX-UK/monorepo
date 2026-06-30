import { Hono } from "hono";
import type { Container } from "../container.js";
import type { MarketingClientContextVars } from "../middleware/marketing-client-context.js";
import type { MarketingConsentVars } from "../middleware/marketing-consent.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  PASSWORD_REQUIRED_POLICY,
  SESSION_REVOKE_POLICY,
  createRequireRecentPasswordAuth,
} from "../middleware/require-recent-password-auth.js";
import { createTurnstileMiddleware } from "../middleware/turnstile.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { UserRouteDeps } from "./users/_shared.js";
import { attachUserDashboardRoutes } from "./users/dashboard.routes.js";
import { attachUserNotificationsRoutes } from "./users/notifications.routes.js";
import { attachUserPreferencesRoutes } from "./users/preferences.routes.js";
import { attachUserProfileRoutes } from "./users/profile.routes.js";
import { attachUserPublicRoutes } from "./users/public.routes.js";
import { attachUserSecurityRoutes } from "./users/security.routes.js";
import { attachUserWatchlistRoutes } from "./users/watchlist.routes.js";

export function createUserRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireAuthAllowSuspended = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
    allowSuspended: true,
  });
  const requirePasswordStepUp = createRequireRecentPasswordAuth(
    container,
    PASSWORD_REQUIRED_POLICY,
  );
  const requireSessionRevokeAuth = createRequireRecentPasswordAuth(
    container,
    SESSION_REVOKE_POLICY,
  );
  const requireTurnstile = createTurnstileMiddleware(container.env?.TURNSTILE_SECRET_KEY);
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string } & MarketingConsentVars &
      MarketingClientContextVars;
  }>();

  const deps: UserRouteDeps = {
    container,
    requireAuth,
    requireAuthAllowSuspended,
    requirePasswordStepUp,
    requireSessionRevokeAuth,
    requireTurnstile,
  };

  attachUserPublicRoutes(r, deps);
  attachUserDashboardRoutes(r, deps);
  attachUserWatchlistRoutes(r, deps);
  attachUserNotificationsRoutes(r, deps);
  attachUserPreferencesRoutes(r, deps);
  attachUserSecurityRoutes(r, deps);
  attachUserProfileRoutes(r, deps);

  return r;
}
