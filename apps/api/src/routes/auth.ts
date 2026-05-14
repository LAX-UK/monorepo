import {
  forgotPasswordBodySchema,
  reauthBodySchema,
  requestEmailChangeSchema,
  setupPasswordBodySchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Container } from "../container.js";
import { createAppLogger } from "../lib/logger.js";
import { extractBetterAuthSessionToken } from "../lib/session-cookie.js";
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
import { setupCredentialPassword } from "../services/auth/credential-setup.service.js";
import {
  clearEmailChangeInProgress,
  confirmEmailChangeFromToken,
  requestEmailChange,
} from "../services/auth/email-change.service.js";
import { runForgotPasswordSideEffects } from "../services/auth/forgot-password.service.js";
import {
  stampReauthWithPassword,
  stampSessionPasswordProofNow,
} from "../services/auth/reauth.service.js";

export function createAuthRoutes(container: Container) {
  const r = new Hono();
  const requireTurnstile = createTurnstileMiddleware(container.env.TURNSTILE_SECRET_KEY);

  const requireAuth = createRequireAuth(container.authenticator, {
    isSuspended: (userId) => container.userSuspensionChecker.isSuspended(userId),
  });
  const requireRecentPasswordAuth = createRequireRecentPasswordAuth(
    container,
    PASSWORD_REQUIRED_POLICY,
  );
  // redis may be absent in unit-test containers; fall back to a no-op passthrough.
  const confirmEmailChangeRateLimit = container.redis
    ? createConfirmEmailChangeRateLimitMiddleware(container.redis)
    : createMiddleware(async (_c, next) => next());

  r.post("/reauth", requireAuth, zValidator("json", reauthBodySchema), async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized", code: "session_required" }, 401);
    const { password } = c.req.valid("json");
    const token = extractBetterAuthSessionToken(c.req.header("cookie"));
    const out = await stampReauthWithPassword({
      authDb: container.authDb,
      userId,
      password,
      sessionTokenFromCookie: token,
    });
    if (out === "ok") {
      void container.authAuditPublisher
        .publish(container.db, {
          eventType: "auth.reauth_success",
          aggregateId: userId,
          payload: {},
          actorUserId: userId,
        })
        .catch(() => {});
      return c.json({ ok: true });
    }
    if (out === "invalid_password") {
      return c.json({ error: "Incorrect password", code: "invalid_credentials" }, 401);
    }
    if (out === "no_credential") {
      return c.json(
        {
          error: "Password re-authentication is not available for this sign-in method.",
          code: "credential_required",
        },
        400,
      );
    }
    return c.json({ error: "Session not found", code: "session_required" }, 401);
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

      void runForgotPasswordSideEffects({
        email,
        webOrigin,
        container,
        clientIp,
        authAudit: container.authAuditPublisher,
      }).catch((err) => {
        const logEnv = {
          LOG_LEVEL: container.env.LOG_LEVEL ?? "info",
          NODE_ENV: container.env.NODE_ENV ?? "production",
        };
        createAppLogger(logEnv).error(
          {
            err: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
          },
          "forgot_password_side_effect_failed",
        );
      });

      return c.json({ ok: true });
    },
  );

  r.post(
    "/setup-password",
    createSetupPasswordRateLimitMiddleware(container.redis),
    requireAuth,
    zValidator("json", setupPasswordBodySchema),
    async (c) => {
      const userId = c.get("userId");
      if (!userId) return c.json({ error: "Unauthorized", code: "session_required" }, 401);

      const { password } = c.req.valid("json");
      const result = await setupCredentialPassword({
        container,
        userId,
        password,
        authAudit: container.authAuditPublisher,
      });
      if (result.ok) {
        const token = extractBetterAuthSessionToken(c.req.header("cookie"));
        void stampSessionPasswordProofNow({
          authDb: container.authDb,
          userId,
          sessionTokenFromCookie: token,
        }).catch(() => {});
        return c.json({ ok: true });
      }
      if (result.kind === "user_not_found") {
        return c.json({ error: "User not found", code: "user_not_found" }, 404);
      }
      if (result.kind === "already_set") {
        return c.json(
          { error: "A password is already set on this account.", code: "credential_already_set" },
          409,
        );
      }
      return c.json({ error: "Could not set password.", code: "setup_password_failed" }, 500);
    },
  );

  r.post(
    "/change-email",
    requireAuth,
    requireRecentPasswordAuth,
    zValidator("json", requestEmailChangeSchema),
    async (c) => {
      const userId = c.get("userId");
      if (!userId) return c.json({ error: "Unauthorized", code: "session_required" }, 401);

      const body = c.req.valid("json");
      const out = await requestEmailChange({
        container,
        userId,
        body,
        authAudit: container.authAuditPublisher,
      });
      if (out.ok) return c.json({ ok: true });
      if (out.kind === "user_not_found") {
        return c.json({ error: "User not found", code: "user_not_found" }, 404);
      }
      if (out.kind === "same_email") {
        return c.json(
          {
            error: "New email must differ from your current address",
            code: "email_change_same_email",
          },
          400,
        );
      }
      return c.json(
        { error: "That email is already in use", code: "email_change_email_taken" },
        409,
      );
    },
  );

  r.delete("/change-email", requireAuth, requireRecentPasswordAuth, async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized", code: "session_required" }, 401);

    const out = await clearEmailChangeInProgress({
      container,
      userId,
      authAudit: container.authAuditPublisher,
    });
    if (out.ok) return c.json({ ok: true });
    return c.json(
      { error: "No email change is in progress", code: "email_change_none_in_progress" },
      400,
    );
  });

  r.post("/confirm-email-change", confirmEmailChangeRateLimit, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { token?: unknown };
    if (typeof body.token !== "string") {
      return c.json({ error: "Missing token", code: "email_change_missing_token" }, 400);
    }

    const result = await confirmEmailChangeFromToken({
      container,
      token: body.token,
      authAudit: container.authAuditPublisher,
    });

    if (result.ok && result.completed) {
      return c.json({ ok: true, completed: true });
    }
    if (result.ok && !result.completed) {
      return c.json({
        ok: true,
        completed: false,
        message:
          result.confirmFor === "old"
            ? "Current address confirmed. Open the email sent to your new address and confirm there to finish."
            : "New address confirmed. Open the email sent to your current address and confirm there to finish.",
      });
    }

    if (result.kind === "user_not_found") {
      return c.json({ error: "User not found", code: "user_not_found" }, 404);
    }
    if (result.kind === "stale_flow") {
      return c.json(
        { error: "Email change token no longer matches this account", code: "email_change_stale" },
        409,
      );
    }
    if (result.kind === "expired") {
      return c.json(
        {
          error: "This email change request has expired. Start again from settings.",
          code: "email_change_expired",
        },
        410,
      );
    }
    if (result.kind === "email_taken") {
      return c.json(
        { error: "That email is already in use", code: "email_change_email_taken" },
        409,
      );
    }
    return c.json({ error: "Invalid or expired token", code: "email_change_token_invalid" }, 400);
  });

  return r;
}
