import {
  forgotPasswordBodySchema,
  reauthBodySchema,
  requestEmailChangeSchema,
  setupPasswordBodySchema,
} from "@auction/validators";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { ContainerAuthRoutesSlice } from "../container.js";
import { respondIdentityHttpJson } from "../lib/identity-route-response.js";
import { extractBetterAuthSessionToken } from "../lib/session-cookie.js";
import { zValidator } from "../lib/z-validator.js";
import {
  createConfirmEmailChangeRateLimitMiddleware,
  createForgotPasswordRateLimitMiddleware,
  createSetupPasswordRateLimitMiddleware,
} from "../middleware/auth-rate-limit.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  PASSWORD_REQUIRED_POLICY,
  createRequireRecentPasswordAuth,
} from "../middleware/require-recent-password-auth.js";
import { createTurnstileMiddleware } from "../middleware/turnstile.js";

export function createAuthRoutes(container: ContainerAuthRoutesSlice) {
  const r = new Hono();
  const requireTurnstile = createTurnstileMiddleware(container.env.TURNSTILE_SECRET_KEY);
  const accountSecurity = container.identityRoutes.accountSecurityHttp;

  const requireAuth = createRequireAuth(container.authenticator, {
    isSuspended: (userId) => container.userSuspensionChecker.isSuspended(userId),
  });
  const requireRecentPasswordAuth = createRequireRecentPasswordAuth(
    container,
    PASSWORD_REQUIRED_POLICY,
  );
  const confirmEmailChangeRateLimit = container.redis
    ? createConfirmEmailChangeRateLimitMiddleware(container.redis)
    : createMiddleware(async (_c, next) => next());

  r.post("/reauth", requireAuth, zValidator("json", reauthBodySchema), async (c) => {
    const { password } = c.req.valid("json");
    const token = extractBetterAuthSessionToken(c.req.header("cookie"));
    const response = await accountSecurity.reauth({
      userId: c.get("userId"),
      password,
      sessionTokenFromCookie: token ?? null,
    });
    return respondIdentityHttpJson(c, response);
  });

  r.post(
    "/forgot-password",
    createForgotPasswordRateLimitMiddleware(container.redis),
    zValidator("json", forgotPasswordBodySchema),
    requireTurnstile,
    async (c) => {
      const body = c.req.valid("json");
      const email = body.email.trim().toLowerCase();
      const webOrigin = container.env.WEB_ORIGIN.replace(/\/$/, "");
      const clientIp =
        c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
        c.req.header("x-real-ip") ??
        undefined;
      const response = await accountSecurity.forgotPassword({
        email,
        webOrigin,
        ...(clientIp !== undefined ? { clientIp } : {}),
      });
      return respondIdentityHttpJson(c, response);
    },
  );

  r.post(
    "/setup-password",
    createSetupPasswordRateLimitMiddleware(container.redis),
    requireAuth,
    zValidator("json", setupPasswordBodySchema),
    async (c) => {
      const { password } = c.req.valid("json");
      const token = extractBetterAuthSessionToken(c.req.header("cookie"));
      const response = await accountSecurity.setupPassword({
        userId: c.get("userId"),
        password,
        sessionTokenFromCookie: token ?? null,
      });
      return respondIdentityHttpJson(c, response);
    },
  );

  r.post(
    "/change-email",
    requireAuth,
    requireRecentPasswordAuth,
    zValidator("json", requestEmailChangeSchema),
    async (c) => {
      const body = c.req.valid("json");
      const response = await accountSecurity.requestEmailChange({
        userId: c.get("userId"),
        body,
      });
      return respondIdentityHttpJson(c, response);
    },
  );

  r.delete("/change-email", requireAuth, requireRecentPasswordAuth, async (c) => {
    const response = await accountSecurity.clearEmailChange({ userId: c.get("userId") });
    return respondIdentityHttpJson(c, response);
  });

  r.post("/confirm-email-change", confirmEmailChangeRateLimit, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { token?: unknown };
    if (typeof body.token !== "string") {
      return c.json({ error: "Missing token", code: "email_change_missing_token" }, 400);
    }
    const response = await accountSecurity.confirmEmailChange({ token: body.token });
    return respondIdentityHttpJson(c, response);
  });

  r.get("/password-status", requireAuth, async (c) => {
    const response = await accountSecurity.getPasswordStatus({ userId: c.get("userId") });
    return respondIdentityHttpJson(c, response);
  });

  return r;
}
