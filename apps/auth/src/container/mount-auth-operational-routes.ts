import { timingSafeEqual } from "node:crypto";
import {
  HOSTED_LOGIN_SCRIPT,
  HOSTED_TWO_FACTOR_SCRIPT,
  OIDC_CONSENT_SCRIPT,
  buildHostedLoginHtml,
  buildHostedTwoFactorHtml,
  type createAuth,
} from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import { sql } from "drizzle-orm";
import type { Hono } from "hono";
import type { Redis } from "ioredis";
import type pino from "pino";
import type { ClientIpResolver } from "../infrastructure/client-ip.js";
import { createMachineTokenRateLimitMiddleware } from "../middleware/auth-rate-limit.js";

export type AuthOperationalRoutes = {
  db: Pick<IdentityDatabase, "execute">;
  auth: ReturnType<typeof createAuth>;
  log: pino.Logger;
  nodeEnv: "development" | "test" | "production";
  release?: string | undefined;
  metricsToken?: string | undefined;
  metrics: { metrics(): Promise<string> };
  clientIp: ClientIpResolver;
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
  app.get("/hosted-two-factor.js", (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.body(HOSTED_TWO_FACTOR_SCRIPT, 200, {
      "Content-Type": "text/javascript; charset=utf-8",
    });
  });
  app.get("/login", (c) => {
    c.header("Cache-Control", "no-store");
    return c.html(buildHostedLoginHtml());
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
  if (options.internal) {
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
      await options.db.execute(sql`select 1`);
      if (options.nodeEnv === "production") {
        const atRest = await options.db.execute<{ pending: boolean }>(sql`
          select exists (
            select 1 from "account"
            where ("access_token" is not null and "access_token" not like 'v1:%')
               or ("refresh_token" is not null and "refresh_token" not like 'v1:%')
               or ("id_token" is not null and "id_token" not like 'v1:%')
            union all
            select 1 from "oauth_access_token"
            where "access_token" not like 'h1:%'
               or "refresh_token" not like 'h1:%'
            union all
            select 1 from "two_factor"
            where "secret" not like 'v1:%' or "backup_codes" not like 'v1:%'
            union all
            select 1 from "jwks_key"
            where "private_jwk" #>> '{}' not like 'v1:%'
          ) as "pending"
        `);
        if (atRest.rows[0]?.pending) throw new Error("auth_at_rest_backfill_required");
      }
      const keySet = await options.auth.api.getJwks();
      if (keySet.keys.length === 0) throw new Error("jwks_empty");
      return c.json({
        service: "auction-auth",
        status: "ok",
        database: "ok",
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
