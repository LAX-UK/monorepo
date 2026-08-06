import { timingSafeEqual } from "node:crypto";
import {
  DEFAULT_JWT_AUDIENCE,
  buildOidcDiscoveryDocument,
  buildTrustedAuthOrigins,
  createAuth,
  createAuthLifecycleCallbacks,
  createAuthNoStoreMiddleware,
  createEnvelopeCrypto,
  createJwksAdapter,
  parseAuthDekKey,
  runSignInTurnstileGate,
  stampLastPasswordAuthFromSignInResponse,
  startJwksRetirementSchedule,
} from "@auction/auth";
import { closeDb, createDb, publishUserRegistered } from "@auction/db";
import { session } from "@auction/db/schema";
import { ConsoleEmailService, PostmarkEmailService, bindEmailQueue } from "@auction/email";
import { Sentry, getBullMqTelemetry, initNodeSentry } from "@auction/observability";
import { EMAIL_QUEUE_NAME, createBullQueueOptions } from "@auction/queues";
import {
  ConsolePhoneVerificationService,
  TwilioVerifyService,
  isTwilioVerifyConfigured,
} from "@auction/sms";
import { serve } from "@hono/node-server";
import { Queue } from "bullmq";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Redis } from "ioredis";
import pino from "pino";
import { Registry, collectDefaultMetrics } from "prom-client";
import { createAuthRepositories } from "./container/create-auth-repositories.js";
import { loadAuthEnv } from "./env.js";
import {
  createAuthIssuerRateLimitMiddleware,
  createMagicLinkIssuerRateLimitMiddleware,
  createSendVerificationIssuerRateLimitMiddleware,
} from "./middleware/auth-rate-limit.js";
import { createSecurityHeadersMiddleware } from "./middleware/security-headers.js";
import { publishUserEmailVerified } from "./services/publish-user-email-verified.js";

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
const authRepositories = createAuthRepositories(db);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
redis.on("error", (err: Error) => {
  log.error({ err }, "redis connection error");
  Sentry.captureException(err);
});
const bullTelemetry = getBullMqTelemetry("auction-auth");
const emailQueue = new Queue<{ outboxId: string }>(
  EMAIL_QUEUE_NAME,
  createBullQueueOptions(EMAIL_QUEUE_NAME, {
    connection: redis,
    ...(bullTelemetry ? { telemetry: bullTelemetry } : {}),
  }),
);
const emailService =
  env.EMAIL_PROVIDER === "postmark"
    ? new PostmarkEmailService(db, bindEmailQueue(emailQueue))
    : new ConsoleEmailService(db, bindEmailQueue(emailQueue));

const webOrigins = buildTrustedAuthOrigins({
  webOrigin: env.WEB_ORIGIN,
  webOrigins: env.WEB_ORIGINS,
  additionalOrigins: env.SSR_TRUSTED_ORIGINS,
});
const envelope =
  env.AUTH_DEK_KEY && env.AUTH_DEK_KEY.trim().length > 0
    ? createEnvelopeCrypto(parseAuthDekKey(env.AUTH_DEK_KEY.trim()))
    : undefined;

const phoneVerification =
  env.ENABLE_PHONE_VERIFICATION && isTwilioVerifyConfigured(env)
    ? TwilioVerifyService.fromEnv(env)
    : new ConsolePhoneVerificationService();

const lifecycle = createAuthLifecycleCallbacks({
  markUserForOAuthAttribution: (userId) =>
    redis.set(`marketing:new-user:${userId}`, "1", "EX", 30 * 60, "NX").then(() => undefined),
  completeOAuthAttribution: async ({ userId, providerId }) => {
    await redis.eval(
      `
        if redis.call("EXISTS", KEYS[1]) ~= 1 then return 0 end
        redis.call("DEL", KEYS[1])
        if ARGV[1] == "google" or ARGV[1] == "apple" then
          redis.call("SET", KEYS[2], ARGV[1], "EX", ARGV[2], "NX")
          return 1
        end
        return 0
      `,
      2,
      `marketing:new-user:${userId}`,
      `marketing:oauth-signup:${userId}`,
      providerId,
      30 * 60,
    );
  },
  publishUserRegisteredForAccount: async ({ userId }) => {
    const authUser = await db.query.user.findFirst({
      where: (users, { eq: equals }) => equals(users.id, userId),
      columns: { id: true, email: true, name: true },
    });
    if (!authUser) {
      throw new Error(`Cannot publish user.registered: auth user ${userId} was not found`);
    }
    await publishUserRegistered(
      db,
      {
        userId: authUser.id,
        name: authUser.name,
        email: authUser.email,
      },
      { producer: "apps/auth" },
    );
  },
  publishUserEmailVerified: (authUser) =>
    publishUserEmailVerified(authRepositories.userEmailVerifiedPublisher, {
      userId: authUser.id,
      email: authUser.email,
    }),
  onNonBlockingError: (_stage, error, userId) => {
    log.error({ error, userId }, "failed to mark new user for OAuth attribution");
  },
});

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
  phoneVerification,
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
  ...lifecycle,
  enableNewDeviceLoginEmail: env.NODE_ENV === "production",
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
app.use("/api/auth/*", createSendVerificationIssuerRateLimitMiddleware(redis));
app.use("/api/auth/*", createAuthIssuerRateLimitMiddleware(redis));
app.use("/api/auth/*", createMagicLinkIssuerRateLimitMiddleware(redis));
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
  c.header("Cache-Control", "public, max-age=60");
  return c.json(buildOidcDiscoveryDocument(env.OIDC_ISSUER_URL));
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
    void Promise.allSettled([emailQueue.close(), redis.quit(), closeDb(db)]).finally(() => {
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
