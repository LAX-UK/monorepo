import { timingSafeEqual } from "node:crypto";
import type { createAuth } from "@auction/auth";
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
