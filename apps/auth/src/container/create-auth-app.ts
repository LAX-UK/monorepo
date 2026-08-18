import { Sentry } from "@auction/observability";
import { Hono } from "hono";
import type pino from "pino";
import { createSecurityHeadersMiddleware } from "../middleware/security-headers.js";
import {
  type AuthOperationalRoutes,
  mountAuthOperationalRoutes,
} from "./mount-auth-operational-routes.js";
import type { OidcRouteMountOptions } from "./mount-oidc-routes.js";
import { mountOidcRoutes } from "./mount-oidc-routes.js";

type Counter = { inc(labels: Record<string, string>): void };

export type CreateAuthAppOptions = {
  log: pino.Logger;
  operational: Omit<AuthOperationalRoutes, "log">;
  oidc: OidcRouteMountOptions;
  issuerHttpOutcomes: Counter;
};

export function createAuthApp(options: CreateAuthAppOptions): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    options.log.error({ ...serializeError(err), path: c.req.path }, "auth_http_error");
    Sentry.captureException(err);
    return c.json({ error: "Internal server error" }, 500);
  });
  app.use("*", createSecurityHeadersMiddleware());
  app.use("/api/auth/*", async (c, next) => {
    await next();
    const path = c.req.path;
    const operation = path.includes("/oauth2/token")
      ? "token"
      : path.includes("/sign-in/")
        ? "sign_in"
        : path.includes("/sign-up/")
          ? "sign_up"
          : path.includes("/get-session")
            ? "session"
            : "other";
    options.issuerHttpOutcomes.inc({ operation, status: String(c.res.status) });
  });
  mountAuthOperationalRoutes(app, { ...options.operational, log: options.log });
  mountOidcRoutes(app, options.oidc);
  return app;
}

function serializeError(err: Error) {
  return {
    causeName: err.name,
    causeMessage: err.message,
    causeStack: err.stack?.slice(0, 3000),
  };
}
