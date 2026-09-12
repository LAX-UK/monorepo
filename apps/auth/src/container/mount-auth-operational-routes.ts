import { timingSafeEqual } from "node:crypto";
import {
  HOSTED_FORGOT_PASSWORD_SCRIPT,
  HOSTED_LOGIN_SCRIPT,
  HOSTED_RESEND_VERIFICATION_SCRIPT,
  HOSTED_RESET_PASSWORD_SCRIPT,
  HOSTED_SIGN_UP_SCRIPT,
  HOSTED_TWO_FACTOR_SCRIPT,
  HOSTED_VERIFY_EMAIL_SCRIPT,
  OIDC_CONSENT_SCRIPT,
  buildHostedForgotPasswordHtml,
  buildHostedLoginHtml,
  buildHostedResendVerificationHtml,
  buildHostedResetPasswordHtml,
  buildHostedSignUpHtml,
  buildHostedTwoFactorHtml,
  buildHostedVerifyEmailHtml,
  type createAuth,
} from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Hono } from "hono";
import type { Redis } from "ioredis";
import type pino from "pino";
import type { ClientIpResolver } from "../infrastructure/client-ip.js";
import { createMachineTokenRateLimitMiddleware } from "../middleware/auth-rate-limit.js";
import { probeAuthReadiness } from "./auth-health.js";

export type AuthOperationalRoutes = {
  db: Pick<IdentityDatabase, "execute">;
  auth: ReturnType<typeof createAuth>;
  log: pino.Logger;
  nodeEnv: "development" | "test" | "production";
  release?: string | undefined;
  metricsToken?: string | undefined;
  metrics: { metrics(): Promise<string> };
  clientIp: ClientIpResolver;
  clientIpDiagnostics?: boolean | undefined;
  redis?: Redis | undefined;
  internal?: { redis: Redis; routes: Hono } | undefined;
};

export function mountAuthOperationalRoutes(app: Hono, options: AuthOperationalRoutes): void {
  app.get("/oidc-consent.js", (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.body(OIDC_CONSENT_SCRIPT, 200, {
      "Content-Type": "text/javascript; charset=utf-8",
    });
  });
  app.get("/hosted-login.js", (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.body(HOSTED_LOGIN_SCRIPT, 200, {
      "Content-Type": "text/javascript; charset=utf-8",
    });
  });
  app.get("/hosted-sign-up.js", (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.body(HOSTED_SIGN_UP_SCRIPT, 200, {
      "Content-Type": "text/javascript; charset=utf-8",
    });
  });
  app.get("/hosted-forgot-password.js", (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.body(HOSTED_FORGOT_PASSWORD_SCRIPT, 200, {
      "Content-Type": "text/javascript; charset=utf-8",
    });
  });
  app.get("/hosted-reset-password.js", (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.body(HOSTED_RESET_PASSWORD_SCRIPT, 200, {
      "Content-Type": "text/javascript; charset=utf-8",
    });
  });
  app.get("/hosted-two-factor.js", (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.body(HOSTED_TWO_FACTOR_SCRIPT, 200, {
      "Content-Type": "text/javascript; charset=utf-8",
    });
  });
  app.get("/hosted-verify-email.js", (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.body(HOSTED_VERIFY_EMAIL_SCRIPT, 200, {
      "Content-Type": "text/javascript; charset=utf-8",
    });
  });
  app.get("/hosted-resend-verification.js", (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.body(HOSTED_RESEND_VERIFICATION_SCRIPT, 200, {
      "Content-Type": "text/javascript; charset=utf-8",
    });
  });
  app.get("/login", (c) => {
    c.header("Cache-Control", "no-store");
    return c.html(buildHostedLoginHtml());
  });
  app.get("/sign-up", (c) => {
    c.header("Cache-Control", "no-store");
    return c.html(buildHostedSignUpHtml());
  });
  app.get("/forgot-password", (c) => {
    c.header("Cache-Control", "no-store");
    return c.html(buildHostedForgotPasswordHtml());
  });
  app.get("/reset-password", (c) => {
    c.header("Cache-Control", "no-store");
    return c.html(buildHostedResetPasswordHtml());
  });
  app.get("/two-factor", (c) => {
    c.header("Cache-Control", "no-store");
    const next = c.req.query("next");
    const callbackURL = c.req.query("callbackURL");
    return c.html(
      buildHostedTwoFactorHtml({
        next: typeof next === "string" ? next : null,
        callbackURL: typeof callbackURL === "string" ? callbackURL : null,
      }),
    );
  });
  app.get("/verify-email", (c) => {
    c.header("Cache-Control", "no-store");
    return c.html(buildHostedVerifyEmailHtml());
  });
  app.get("/resend-verification", (c) => {
    c.header("Cache-Control", "no-store");
    return c.html(buildHostedResendVerificationHtml());
  });
  if (options.internal) {
    if (options.clientIpDiagnostics) {
      app.use("/internal/oauth/*", async (c, next) => {
        let remoteAddress: string | undefined;
        try {
          remoteAddress = getConnInfo(c).remote.address;
        } catch {
          remoteAddress = undefined;
        }
        options.log.info(
          {
            remoteAddress,
            xForwardedFor: c.req.header("x-forwarded-for"),
            xRealIp: c.req.header("x-real-ip"),
            cfConnectingIp: c.req.header("cf-connecting-ip"),
            doConnectingIp: c.req.header("do-connecting-ip"),
          },
          "auth_client_ip_diagnostics",
        );
        await next();
      });
    }
    app.use(
      "/internal/oauth/*",
      createMachineTokenRateLimitMiddleware(options.internal.redis, options.clientIp),
    );
    app.route("/internal", options.internal.routes);
  }
  app.get("/health/live", (c) =>
    c.json({ service: "auction-auth", status: "ok", release: options.release ?? "unknown" }),
  );
  app.get("/health/ready", async (c) => {
    try {
      await probeAuthReadiness({
        db: options.db,
        redis: options.redis ?? options.internal?.redis,
        loadJwks: () => options.auth.api.getJwks(),
      });
      return c.json({
        service: "auction-auth",
        status: "ok",
        database: "ok",
        redis: (options.redis ?? options.internal?.redis) ? "ok" : "skipped",
        jwks: "ok",
        release: options.release ?? "unknown",
      });
    } catch (err) {
      options.log.error({ err }, "auth readiness failed");
      return c.json({ service: "auction-auth", status: "degraded" }, 503);
    }
  });
  app.get("/metrics", async (c) => {
    if (options.nodeEnv === "production" && !options.metricsToken) {
      return c.json({ error: "not_found" }, 404);
    }
    if (options.metricsToken) {
      const actual = Buffer.from(c.req.header("authorization") ?? "");
      const expected = Buffer.from(`Bearer ${options.metricsToken}`);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }
    return c.text(await options.metrics.metrics(), 200, {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    });
  });
}
