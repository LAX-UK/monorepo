import { createAuth, createJwksAdapter, startJwksRetirementSchedule } from "@auction/auth";
import { createDb } from "@auction/db";
import { serve } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import pino from "pino";
import { Registry, collectDefaultMetrics } from "prom-client";
import { loadAuthEnv } from "./env.js";

const env = loadAuthEnv();
if (env.SENTRY_DSN_AUTH) {
  Sentry.init({
    dsn: env.SENTRY_DSN_AUTH,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.05 : 1,
  });
}

const log = pino({
  level: env.LOG_LEVEL,
  base: { service: "auction-auth", env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
});

const db = createDb(env.DATABASE_URL_AUTH ?? env.DATABASE_URL);
const auth = createAuth({
  db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.API_PUBLIC_URL,
  issuerURL: env.OIDC_ISSUER_URL,
  trustedOrigins: [env.WEB_ORIGIN],
  allowInsecureCookies: env.ALLOW_HTTP_COOKIES,
  cookieDomain: env.COOKIE_DOMAIN,
  webOrigin: env.WEB_ORIGIN,
  googleClientId: env.GOOGLE_CLIENT_ID,
  googleClientSecret: env.GOOGLE_CLIENT_SECRET,
  appleClientId: env.APPLE_CLIENT_ID,
  appleClientSecret: env.APPLE_CLIENT_SECRET,
});
const jwks = createJwksAdapter(db);
const retirementSchedule = startJwksRetirementSchedule({ db, log });
const metrics = new Registry();
collectDefaultMetrics({ register: metrics, prefix: "auction_auth_" });

const app = new Hono();
app.onError((err, c) => {
  log.error({ ...serializeError(err), path: c.req.path }, "auth_http_error");
  Sentry.captureException(err);
  return c.json({ error: "Internal server error" }, 500);
});
app.get("/health/live", (c) => c.json({ service: "auction-auth", status: "ok" }));
app.get("/health/ready", async (c) => {
  try {
    await db.execute(sql`select 1`);
    await jwks.getPublicJwks();
    return c.json({ service: "auction-auth", status: "ok", database: "ok", jwks: "ok" });
  } catch (err) {
    log.error({ err }, "auth readiness failed");
    return c.json({ service: "auction-auth", status: "degraded" }, 503);
  }
});
app.get("/metrics", async (c) =>
  c.text(await metrics.metrics(), 200, {
    "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
  }),
);
app.use(
  "/.well-known/*",
  cors({
    origin: "*",
    maxAge: 60,
  }),
);
// Better Auth's `app.all("/api/auth/*", ...)` does not handle CORS preflight, so the browser
// receives 404 for OPTIONS and blocks the actual login POST. Mount CORS for the auth API
// surface explicitly using the same shape as apps/api so cross-origin sign-in from
// WEB_ORIGIN works (cookies + JSON body require credentials + Content-Type allowed).
app.use(
  "/api/auth/*",
  cors({
    origin: env.WEB_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);
app.get("/.well-known/jwks.json", async (c) => {
  c.header("Cache-Control", "public, max-age=60");
  return c.json(await jwks.getPublicJwks());
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
  const issuer = env.OIDC_ISSUER_URL.replace(/\/$/, "");
  const authBase = `${issuer}/api/auth`;
  c.header("Cache-Control", "public, max-age=60");
  return c.json({
    issuer,
    authorization_endpoint: `${authBase}/oauth2/authorize`,
    token_endpoint: `${authBase}/oauth2/token`,
    userinfo_endpoint: `${authBase}/oauth2/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile", "email", "offline_access"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    claims_supported: ["sub", "email", "email_verified", "name", "image", "role"],
    code_challenge_methods_supported: ["S256"],
  });
});
app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

const server = serve(
  {
    fetch: app.fetch,
    hostname: "0.0.0.0",
    port: env.PORT,
  },
  (info) => {
    log.info({ port: info.port }, "auth service listening");
  },
);

function shutdown(signal: NodeJS.Signals) {
  log.info({ signal }, "draining auth service");
  retirementSchedule.stop();
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close((err) => {
    if (err) {
      log.error({ err }, "failed to close auth server");
      process.exit(1);
    }
    clearTimeout(timeout);
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

function serializeError(err: Error) {
  return {
    causeName: err.name,
    causeMessage: err.message,
    causeStack: err.stack?.slice(0, 3000),
  };
}
