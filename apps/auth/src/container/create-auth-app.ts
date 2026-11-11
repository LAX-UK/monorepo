import {
  type HostedAuthCapabilities,
  normalizeAuthorizePromptForCreate,
  stampTrustedClientIp,
} from "@auction/auth";
import { Sentry } from "@auction/observability";
import { Hono } from "hono";
import type pino from "pino";
import { registerFedcmRoutes } from "../http/fedcm.routes.js";
import { createLoginStatusMiddleware } from "../http/login-status.middleware.js";
import { createClientIpResolver } from "../infrastructure/client-ip.js";
import { createBrowserErrorPageMiddleware } from "../middleware/browser-error-page.js";
import { createOidcPromptCookieHardeningMiddleware } from "../middleware/oidc-prompt-cookie-hardening.js";
import { createSecurityHeadersMiddleware } from "../middleware/security-headers.js";
import { hasStaffMarker } from "../services/staff-marker.js";
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
  oidc: Omit<OidcRouteMountOptions, "clientIp" | "log" | "hostedCapabilities">;
  issuerHttpOutcomes: Counter;
};

export function createAuthApp(options: CreateAuthAppOptions): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    options.log.error({ ...serializeError(err), path: c.req.path }, "auth_http_error");
    Sentry.captureException(err);
    return c.json({ error: "Internal server error" }, 500);
  });
  const clientIp = createClientIpResolver(
    options.oidc.env.AUTH_TRUSTED_PROXY_CIDRS,
    options.oidc.env.AUTH_TRUSTED_CLOUDFLARE_PROXY_CIDRS,
    options.oidc.env.AUTH_TRUSTED_PROXY_HOPS,
  );
  // Better Auth hooks only see headers: hand them the peer-checked address, never a client's copy.
  app.use("*", async (c, next) => {
    stampTrustedClientIp(c.req.raw.headers, clientIp(c));
    await next();
  });
  app.use(
    "*",
    createSecurityHeadersMiddleware({
      turnstileEnabled: Boolean(options.oidc.env.TURNSTILE_SITE_KEY),
    }),
  );
  const hostedCapabilities: HostedAuthCapabilities = {
    googleEnabled: Boolean(
      options.oidc.env.GOOGLE_CLIENT_ID && options.oidc.env.GOOGLE_CLIENT_SECRET,
    ),
    appleEnabled: Boolean(options.oidc.env.APPLE_CLIENT_ID && options.oidc.env.APPLE_CLIENT_SECRET),
    phoneEnabled: options.oidc.env.ENABLE_PHONE_VERIFICATION,
    turnstileSiteKey: options.oidc.env.TURNSTILE_SITE_KEY ?? null,
    shopOrigin: options.oidc.env.SHOP_ORIGIN,
    artOrigin: options.oidc.env.LAX_ART_ORIGIN,
    shopAdminOrigin: options.oidc.env.SHOP_ADMIN_ORIGIN,
    bidOrigin: options.oidc.env.WEB_ORIGIN,
    ...(options.oidc.env.LAX_ACCOUNT_ORIGIN
      ? { accountOrigin: options.oidc.env.LAX_ACCOUNT_ORIGIN }
      : {}),
    passkeysEnabled: options.oidc.env.PASSKEYS_ENABLED,
    emailFirst: options.oidc.env.HOSTED_AUTH_EMAIL_FIRST,
    requireEmailVerification: options.oidc.env.REQUIRE_EMAIL_VERIFICATION,
  };
  app.use("*", createLoginStatusMiddleware());
  app.use("*", createBrowserErrorPageMiddleware(hostedCapabilities));
  app.use("*", createOidcPromptCookieHardeningMiddleware());
  registerFedcmRoutes(app, {
    issuerOrigin: options.oidc.env.OIDC_ISSUER_URL.replace(/\/+$/, ""),
    enabled: options.oidc.env.FEDCM_ENABLED,
  });
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
  mountHostedAuthAssets(app);
  mountHostedAuthPages(app, {
    ...hostedCapabilities,
    getSession: (headers) => options.oidc.auth.api.getSession({ headers }),
    readTwoFactorRequirement: options.oidc.readTwoFactorRequirement,
    readConfirmMethods: async (subjectId) => {
      const methods = await options.oidc.identityOperations.readSignInMethods(subjectId);
      return {
        password: methods.hasPassword,
        passkey: methods.passkeys.length > 0,
        providers: methods.social.map((link) => link.provider),
        // A failed read throws, and the ordinary sign-in page is shown instead.
        staff: await hasStaffMarker(options.oidc.socialSubjectPorts, subjectId),
      };
    },
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
  mountOidcRoutes(app, { ...options.oidc, hostedCapabilities, clientIp, log: options.log });
  return app;
}

function serializeError(err: Error) {
  return {
    causeName: err.name,
    causeMessage: err.message,
    causeStack: err.stack?.slice(0, 3000),
  };
}
