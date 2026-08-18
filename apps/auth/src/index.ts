import { AUTH_TIMINGS } from "@auction/auth";
import { closeDb } from "@auction/db";
import { initNodeSentry } from "@auction/observability";
import { serve } from "@hono/node-server";
import pino from "pino";
import { createAuthApp } from "./container/create-auth-app.js";
import { createAuthInfra } from "./container/create-auth-infra.js";
import { createAuthIssuer } from "./container/create-auth-issuer.js";
import { createAuthMetrics } from "./container/create-auth-metrics.js";
import { createAuthRepositories } from "./container/create-auth-repositories.js";
import { createAuthRequestHandler } from "./container/create-auth-request-handler.js";
import { createAuthSchedules } from "./container/create-auth-schedules.js";
import { createOidcRouteServices } from "./container/create-oidc-route-services.js";
import { createRefreshTokenFamilyRepository } from "./container/create-refresh-token-family-repository.js";
import { loadAuthEnv } from "./env.js";
import { createInternalIdentityRoutes } from "./routes/internal-identity.routes.js";
import { IdentityLifecycleService } from "./services/identity-lifecycle.service.js";
import { IdentityOperationsService } from "./services/identity-operations.service.js";

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

const infra = createAuthInfra(env, log);
const { db, redis, emailQueue, emailService, webOrigins, envelope, phoneVerification } = infra;
const repositories = createAuthRepositories(db);
const services = createOidcRouteServices({
  db,
  redis,
  issuer: env.OIDC_ISSUER_URL,
  jwks: infra.jwks,
  recentStepUpMaxAgeSec: AUTH_TIMINGS.recentPasswordProofMaxAgeSec,
  environment: env.NODE_ENV,
});
const auth = createAuthIssuer({
  env,
  db,
  redis,
  log,
  email: emailService,
  phoneVerification,
  trustedOrigins: webOrigins,
  logout: services.oidc.logout,
  oidcSessions: services.oidc.sessions,
  userEmailVerifiedPublisher: repositories.userEmailVerifiedPublisher,
});
const identityOperations = new IdentityOperationsService(db, emailService, services.oidc.logout);
const identityLifecycle = new IdentityLifecycleService(db, services.oidc.logout);
const authHandler = createAuthRequestHandler({
  db,
  auth,
  oidcSessions: services.oidc.sessions,
  logout: services.oidc.logout,
});
const metrics = createAuthMetrics();
const schedules = createAuthSchedules({
  db,
  log,
  identityOperations,
  logoutDelivery: services.oidc.logoutDelivery,
  ssfStreams: services.ssf.streams,
  ssfDelivery: services.ssf.delivery,
  ssfEnabled: env.SSF_DELIVERY_ENABLED,
  ssfTimeoutMs: env.SSF_DELIVERY_TIMEOUT_MS,
  ssfMaxAttempts: env.SSF_DELIVERY_MAX_ATTEMPTS,
  onSsfOutcome: (outcome, deliveryId) => {
    metrics.ssfDeliveryOutcomes.inc({ outcome });
    if (outcome !== "delivered") log.warn({ outcome, deliveryId }, "ssf_delivery_outcome");
  },
});
const internal =
  env.IDENTITY_MACHINE_CLIENT_ID && env.IDENTITY_MACHINE_CLIENT_SECRET
    ? {
        redis,
        routes: createInternalIdentityRoutes({
          lifecycle: identityLifecycle,
          operations: identityOperations,
          redis,
          machineClientId: env.IDENTITY_MACHINE_CLIENT_ID,
          machineClientSecret: env.IDENTITY_MACHINE_CLIENT_SECRET,
          allowMerge: env.IDENTITY_MERGE_ENABLED,
          onOperation: (operation, subjectId) => {
            metrics.identityLifecycleOperations.inc({ operation });
            log.info({ operation, subjectId }, "identity_lifecycle_operation");
          },
        }),
      }
    : undefined;
const refreshFamilies = createRefreshTokenFamilyRepository(db, services.oidc.logout);
const app = createAuthApp({
  log,
  issuerHttpOutcomes: metrics.issuerHttpOutcomes,
  operational: {
    db,
    auth,
    nodeEnv: env.NODE_ENV,
    metricsToken: env.METRICS_TOKEN,
    metrics: metrics.registry,
    ...(internal ? { internal } : {}),
  },
  oidc: {
    env,
    db,
    redis,
    auth,
    webOrigins,
    retryResponseCrypto: envelope,
    refreshFamilies,
    replay: {
      reserve: async (key, value, ttlSec) =>
        (await redis.set(key, value, "EX", ttlSec, "NX")) === "OK",
      get: (key) => redis.get(key),
      put: async (key, value, ttlSec) => {
        await redis.set(key, value, "EX", ttlSec);
      },
      delete: async (key) => {
        await redis.del(key);
      },
    },
    services,
    authHandler,
    metrics: {
      refreshRotationOutcomes: metrics.refreshRotationOutcomes,
      tokenExchangeOutcomes: metrics.tokenExchangeOutcomes,
    },
  },
});

const server = serve({ fetch: app.fetch, hostname: "0.0.0.0", port: env.PORT }, (info) =>
  log.info({ port: info.port }, "auth service listening"),
);

function shutdown(signal: NodeJS.Signals) {
  log.info({ signal }, "draining auth service");
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close((err) => {
    if (err) {
      log.error({ err }, "failed to close auth server");
      process.exit(1);
    }
    void schedules
      .stop()
      .then(() => Promise.allSettled([emailQueue.close(), redis.quit(), closeDb(db)]))
      .finally(() => {
        clearTimeout(timeout);
        process.exit(0);
      });
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
