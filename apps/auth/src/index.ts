import { timingSafeEqual } from "node:crypto";
import {
  DEFAULT_JWT_AUDIENCE,
  createAuth,
  createEnvelopeCrypto,
  createJwksAdapter,
  parseAuthDekKey,
  runSignInTurnstileGate,
  stampLastPasswordAuthFromSignInResponse,
  startJwksRetirementSchedule,
} from "@auction/auth";
import { createDb } from "@auction/db";
import { session } from "@auction/db/schema";
import { ConsoleEmailService, PostmarkEmailService } from "@auction/email";
import { Sentry, initNodeSentry } from "@auction/observability";
import { serve } from "@hono/node-server";
import { Queue } from "bullmq";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Redis } from "ioredis";
import pino from "pino";
import { Registry, collectDefaultMetrics } from "prom-client";
import { loadAuthEnv } from "./env.js";
import { trustedWebOrigins } from "./lib/trusted-web-origins.js";
import { createAuthNoStoreMiddleware } from "./middleware/auth-cache-control.js";
import { createAuthIssuerRateLimitMiddleware } from "./middleware/auth-rate-limit.js";
import { createSecurityHeadersMiddleware } from "./middleware/security-headers.js";
import { publishUserRegistered } from "./services/publish-user-registered.js";

const env = loadAuthEnv();
if (env.SENTRY_DSN_AUTH) {
  initNodeSentry({
    dsn: env.SENTRY_DSN_AUTH,
    appEnv: env.APP_ENV,
    nodeEnv: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1,
  });
}

const log = pino({
  level: env.LOG_LEVEL,
  base: { service: "auction-auth", env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
});

const db = createDb(env.DATABASE_URL_AUTH ?? env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const emailQueue = new Queue<{ outboxId: string }>("email", { connection: redis });
const emailService =
  env.EMAIL_PROVIDER === "postmark"
    ? new PostmarkEmailService(db, emailQueue)
    : new ConsoleEmailService(db, emailQueue);

const webOrigins = trustedWebOrigins(env);
const envelope =
  env.AUTH_DEK_KEY && env.AUTH_DEK_KEY.trim().length > 0
    ? createEnvelopeCrypto(parseAuthDekKey(env.AUTH_DEK_KEY.trim()))
    : undefined;

const auth = createAuth({
  db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.API_PUBLIC_URL,
  issuerURL: env.OIDC_ISSUER_URL,
  trustedOrigins: webOrigins,
  allowInsecureCookies: env.ALLOW_HTTP_COOKIES,
  cookieDomain: env.COOKIE_DOMAIN,
  webOrigin: env.WEB_ORIGIN,
  googleClientId: env.GOOGLE_CLIENT_ID,
  googleClientSecret: env.GOOGLE_CLIENT_SECRET,
  appleClientId: env.APPLE_CLIENT_ID,
  appleClientSecret: env.APPLE_CLIENT_SECRET,
  email: emailService,
  requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
  jwtAudience: env.JWT_AUDIENCE ?? DEFAULT_JWT_AUDIENCE,
  authDekKey: env.AUTH_DEK_KEY?.trim(),
  revokeAllSessions: async (userId) => {
    const rows = await db
      .delete(session)
      .where(eq(session.userId, userId))
      .returning({ id: session.id });
    return rows.length;
  },
  onUserCreated: async (authUser) => {
    await publishUserRegistered(db, {
      userId: authUser.id,
      name: authUser.name,
      email: authUser.email,
    });
  },
});
const jwks = createJwksAdapter(db, envelope);
const retirementSchedule = startJwksRetirementSchedule({ db, log });
const metrics = new Registry();
collectDefaultMetrics({ register: metrics, prefix: "auction_auth_" });

const app = new Hono();
app.onError((err, c) => {
  log.error({ ...serializeError(err), path: c.req.path }, "auth_http_error");
  Sentry.captureException(err);
  return c.json({ error: "Internal server error" }, 500);
});
app.use("*", createSecurityHeadersMiddleware());
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
app.get("/metrics", async (c) => {
  if (env.NODE_ENV === "production") {
    if (!env.METRICS_TOKEN) {
      return c.json({ error: "not_found" }, 404);
    }
    const auth = c.req.header("authorization") ?? "";
    const expected = `Bearer ${env.METRICS_TOKEN}`;
    const a = Buffer.from(auth);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  } else if (env.METRICS_TOKEN) {
    const auth = c.req.header("authorization") ?? "";
    const expected = `Bearer ${env.METRICS_TOKEN}`;
    const a = Buffer.from(auth);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }
  return c.text(await metrics.metrics(), 200, {
    "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
  });
});
app.use(
  "/.well-known/*",
  cors({
    origin: "*",
    maxAge: 60,
  }),
);
app.use(
  "/api/auth/*",
  cors({
    origin: webOrigins,
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);
app.use("/api/auth/*", createAuthNoStoreMiddleware());
app.use("/api/auth/*", createAuthIssuerRateLimitMiddleware(redis));
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
app.all("/api/auth/*", async (c) =>
  runSignInTurnstileGate({
    incoming: c.req.raw,
    redis,
    turnstileSecret: env.TURNSTILE_SECRET_KEY,
    authHandler: (req) => auth.handler(req),
    onEmailPasswordSignInSuccess: (res) => stampLastPasswordAuthFromSignInResponse(db, res),
  }),
);

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
    void Promise.allSettled([emailQueue.close(), redis.quit()]).finally(() => {
      clearTimeout(timeout);
      process.exit(0);
    });
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
