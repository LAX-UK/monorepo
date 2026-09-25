import { normalizeAuthorizePromptForCreate } from "@auction/auth";
import { Sentry } from "@auction/observability";
import { Hono } from "hono";
import type pino from "pino";
import { createClientIpResolver } from "../infrastructure/client-ip.js";
import { createSecurityHeadersMiddleware } from "../middleware/security-headers.js";
import {
  type AuthOperationalRoutes,
  mountAuthOperationalRoutes,
} from "./mount-auth-operational-routes.js";
import { mountHostedAuthAssets } from "./mount-hosted-auth-assets.js";
import { mountHostedAuthPages } from "./mount-hosted-auth-pages.js";
import type { OidcRouteMountOptions } from "./mount-oidc-routes.js";
import { mountOidcRoutes } from "./mount-oidc-routes.js";

type Counter = { inc(labels: Record<string, string>): void };

export type CreateAuthAppOptions = {
  log: pino.Logger;
  operational: Omit<AuthOperationalRoutes, "log" | "clientIp">;
  oidc: Omit<OidcRouteMountOptions, "clientIp">;
  issuerHttpOutcomes: Counter;
};

export function createAuthApp(options: CreateAuthAppOptions): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    options.log.error({ ...serializeError(err), path: c.req.path }, "auth_http_error");
    Sentry.captureException(err);
    return c.json({ error: "Internal server error" }, 500);
  });
  app.use(
    "*",
    createSecurityHeadersMiddleware({
      turnstileEnabled: Boolean(options.oidc.env.TURNSTILE_SITE_KEY),
    }),
  );
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
  const clientIp = createClientIpResolver(
    options.oidc.env.AUTH_TRUSTED_PROXY_CIDRS,
    options.oidc.env.AUTH_TRUSTED_CLOUDFLARE_PROXY_CIDRS,
  );
  mountHostedAuthAssets(app);
  mountHostedAuthPages(app, {
    googleEnabled: Boolean(
      options.oidc.env.GOOGLE_CLIENT_ID && options.oidc.env.GOOGLE_CLIENT_SECRET,
    ),
    appleEnabled: Boolean(options.oidc.env.APPLE_CLIENT_ID && options.oidc.env.APPLE_CLIENT_SECRET),
    phoneEnabled: options.oidc.env.ENABLE_PHONE_VERIFICATION,
    turnstileSiteKey: options.oidc.env.TURNSTILE_SITE_KEY ?? null,
    shopOrigin: options.oidc.env.SHOP_ORIGIN,
    bidOrigin: options.oidc.env.WEB_ORIGIN,
    emailFirst: options.oidc.env.HOSTED_AUTH_EMAIL_FIRST,
    requireEmailVerification: options.oidc.env.REQUIRE_EMAIL_VERIFICATION,
    getSession: (headers) => options.oidc.auth.api.getSession({ headers }),
  });
  app.use("/api/auth/oauth2/authorize", async (c, next) => {
    const normalized = normalizeAuthorizePromptForCreate(new URL(c.req.url));
    if (normalized) {
      const current = new URL(c.req.url);
      if (normalized.pathname !== current.pathname || normalized.search !== current.search) {
        return c.redirect(`${normalized.pathname}${normalized.search}`, 307);
      }
    }
    await next();
  });
  mountAuthOperationalRoutes(app, {
    ...options.operational,
    log: options.log,
    clientIp,
    clientIpDiagnostics: options.oidc.env.AUTH_CLIENT_IP_DIAGNOSTICS,
  });
  mountOidcRoutes(app, { ...options.oidc, clientIp });
  return app;
}

function serializeError(err: Error) {
  return {
    causeName: err.name,
    causeMessage: err.message,
    causeStack: err.stack?.slice(0, 3000),
  };
}
