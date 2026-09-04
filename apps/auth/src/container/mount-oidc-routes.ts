import {
  type SessionStampStore,
  type createAuth,
  createAuthNoStoreMiddleware,
  runSignInTurnstileGate,
  stampLastPasswordAuthFromSignInResponse,
} from "@auction/auth";
import {
  FIRST_PARTY_SSF_EVENT_TYPES,
  REGISTERED_OIDC_CLIENTS,
  type RegisteredOidcClientId,
  buildOidcDiscoveryDocument,
} from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import type { Hono } from "hono";
import { cors } from "hono/cors";
import type { Redis } from "ioredis";
import type { AuthAppEnv } from "../env.js";
import {
  createAuthIssuerRateLimitMiddleware,
  createMagicLinkIssuerRateLimitMiddleware,
  createSendVerificationIssuerRateLimitMiddleware,
} from "../middleware/auth-rate-limit.js";
import {
  createOAuthTokenRequestContextMiddleware,
  getOAuthTokenRequestContext,
} from "../middleware/oauth-token-request-context.js";
import { createOidcClientPolicyMiddleware } from "../middleware/oidc-client-policy.js";
import {
  type RefreshReplayRedis,
  createRefreshReplayGateMiddleware,
} from "../middleware/refresh-replay-gate.js";
import { createOauthTokenManagementRoutes } from "../routes/oauth-token-management.routes.js";
import { createSsfRoutes } from "../routes/ssf.routes.js";
import { createTokenExchangeRoutes } from "../routes/token-exchange.routes.js";
import type { IRefreshTokenFamilyRepository } from "../services/refresh-token-family.ports.js";
import type { AuthRouteServicesSlice } from "./auth-container-slices.js";
import type { AuthRequestHandler } from "./create-auth-request-handler.js";

type Counter = { inc(labels: Record<string, string>): void };

export type OidcRouteMountOptions = {
  env: AuthAppEnv;
  db: IdentityDatabase;
  sessionStampStore: SessionStampStore;
  redis: Redis;
  auth: ReturnType<typeof createAuth>;
  webOrigins: string[];
  retryResponseCrypto?: { seal(value: string): string; open(value: string): string } | undefined;
  refreshFamilies: IRefreshTokenFamilyRepository;
  replay: RefreshReplayRedis;
  services: AuthRouteServicesSlice;
  authHandler: AuthRequestHandler;
  metrics: {
    refreshRotationOutcomes: Counter;
    tokenExchangeOutcomes: Counter;
  };
};

export function mountOidcRoutes(app: Hono, options: OidcRouteMountOptions): void {
  const { env, services } = options;
  const issuer = env.OIDC_ISSUER_URL.replace(/\/+$/, "");
  app.use("/.well-known/*", cors({ origin: "*", maxAge: 60 }));
  app.use("/api/auth/*", createOidcClientPolicyMiddleware());
  app.use(
    "/api/auth/*",
    cors({
      origin: options.webOrigins,
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }),
  );
  app.use("/api/auth/oauth2/token", createOAuthTokenRequestContextMiddleware());
  app.use(
    "/api/auth/*",
    createRefreshReplayGateMiddleware({
      families: options.refreshFamilies,
      onOutcome: (outcome) => options.metrics.refreshRotationOutcomes.inc({ outcome }),
      ...(options.retryResponseCrypto ? { retryResponseCrypto: options.retryResponseCrypto } : {}),
      replay: options.replay,
    }),
  );
  app.use("/api/auth/*", createAuthNoStoreMiddleware());
  app.use("/api/auth/*", createSendVerificationIssuerRateLimitMiddleware(options.redis));
  app.use("/api/auth/*", createAuthIssuerRateLimitMiddleware(options.redis));
  app.use("/api/auth/*", createMagicLinkIssuerRateLimitMiddleware(options.redis));
  app.get("/.well-known/jwks.json", async (c) => {
    c.header("Cache-Control", "public, max-age=60");
    return c.json(await options.auth.api.getJwks());
  });
  app.get("/.well-known/apple-developer-domain-association.txt", (c) => {
    if (!env.APPLE_DOMAIN_ASSOCIATION) {
      return c.text("Apple domain association file is not configured.", 404);
    }
    c.header("Cache-Control", "public, max-age=3600");
    return c.text(env.APPLE_DOMAIN_ASSOCIATION, 200, {
      "Content-Type": "text/plain; charset=utf-8",
    });
  });
  app.get("/.well-known/openid-configuration", (c) => {
    c.header("Cache-Control", "public, max-age=60");
    return c.json(buildOidcDiscoveryDocument(env.OIDC_ISSUER_URL));
  });
  app.get("/.well-known/ssf-configuration", (c) => {
    c.header("Cache-Control", "public, max-age=60");
    return c.json({
      spec_version: "1_0",
      issuer,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      delivery_methods_supported: ["urn:ietf:rfc:8935"],
      events_supported: FIRST_PARTY_SSF_EVENT_TYPES,
      configuration_endpoint: `${issuer}/ssf/stream`,
      status_endpoint: `${issuer}/ssf/status`,
      verification_endpoint: `${issuer}/ssf/verification`,
      authorization_schemes: [{ spec_urn: "urn:ietf:rfc:6749" }],
      default_subjects: "ALL",
    });
  });
  app.route(
    "/ssf",
    createSsfRoutes({
      clients: services.oidc.confidentialClients,
      service: services.ssf.streams,
    }),
  );
  app.route(
    "/api/auth",
    createOauthTokenManagementRoutes({
      clients: services.oidc.confidentialClients,
      tokens: services.oidc.tokenManagement,
      logout: services.oidc.logout,
    }),
  );
  app.route(
    "/api/auth",
    createTokenExchangeRoutes({
      clients: services.oidc.confidentialClients,
      service: services.oidc.tokenExchange,
      onOutcome: (outcome) => options.metrics.tokenExchangeOutcomes.inc({ outcome }),
    }),
  );
  app.all("/api/auth/oauth2/endsession", async (c) => {
    const requestUrl = new URL(c.req.url);
    const postLogoutRedirectUri = requestUrl.searchParams.get("post_logout_redirect_uri");
    if (!postLogoutRedirectUri) return options.authHandler(c.req.raw);
    const clientId = requestUrl.searchParams.get("client_id");
    if (!clientId || !(clientId in REGISTERED_OIDC_CLIENTS)) {
      return c.json({ error: "invalid_client" }, 400);
    }
    const client = REGISTERED_OIDC_CLIENTS[clientId as RegisteredOidcClientId];
    if (!client.postLogoutRedirectUris.includes(postLogoutRedirectUri)) {
      return c.json(
        {
          error: "invalid_request",
          error_description: "post_logout_redirect_uri is not registered",
        },
        400,
      );
    }
    const state = requestUrl.searchParams.get("state");
    requestUrl.searchParams.delete("post_logout_redirect_uri");
    requestUrl.searchParams.delete("state");
    const upstream = await options.authHandler(new Request(requestUrl, c.req.raw));
    if (!upstream.ok) return upstream;
    const redirect = new URL(postLogoutRedirectUri);
    if (state) redirect.searchParams.set("state", state);
    const headers = new Headers(upstream.headers);
    headers.set("Location", redirect.toString());
    return new Response(null, { status: 302, headers });
  });
  app.all("/api/auth/*", async (c) =>
    runSignInTurnstileGate({
      incoming: c.req.raw,
      redis: options.redis,
      turnstileSecret: env.TURNSTILE_SECRET_KEY,
      authHandler: (request) =>
        options.authHandler(request, getOAuthTokenRequestContext(c)?.authorizationCode ?? null),
      onEmailPasswordSignInSuccess: (response) =>
        stampLastPasswordAuthFromSignInResponse(options.sessionStampStore, response),
    }),
  );
}
