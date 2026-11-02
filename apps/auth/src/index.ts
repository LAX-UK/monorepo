import { AUTH_TIMINGS } from "@auction/auth";
import { closeIdentityDb, createIdentityAuthPorts } from "@auction/identity-db";
import { initNodeSentry } from "@auction/observability";
import { serve } from "@hono/node-server";
import pino from "pino";
import { assertAuthAtRestReady, reconcileAuthAtRestMetric } from "./container/auth-health.js";
import { createAuthApp } from "./container/create-auth-app.js";
import { createAuthInfra } from "./container/create-auth-infra.js";
import { createAuthIssuer } from "./container/create-auth-issuer.js";
import { createAuthMetrics } from "./container/create-auth-metrics.js";
import { createAuthRepositories } from "./container/create-auth-repositories.js";
import { createAuthRequestHandler } from "./container/create-auth-request-handler.js";
import { createAuthSchedules } from "./container/create-auth-schedules.js";
import { createIdentityAddressService } from "./container/create-identity-address-service.js";
import { createIdentityLifecycleService } from "./container/create-identity-lifecycle-service.js";
import { createIdentityOperationsService } from "./container/create-identity-operations-service.js";
import { createOidcRouteServices } from "./container/create-oidc-route-services.js";
import { createRefreshTokenFamilyRepository } from "./container/create-refresh-token-family-repository.js";
import { createRefreshedIdTokenService } from "./container/create-refreshed-id-token-service.js";
import {
  createDurableSecurityEffects,
  createSecurityNoticeService,
} from "./container/create-security-services.js";
import { loadAuthEnv } from "./env.js";
import { withAlertingLog } from "./infrastructure/alerting-log.js";
import { createInternalIdentityRoutes } from "./routes/internal-identity.routes.js";
import { createAccountAccessClaimsResolver } from "./services/account-access-claims.js";
import { AccountDeletionService } from "./services/account-deletion.service.js";
import { EmailChangeService } from "./services/email-change.service.js";
import { createTwoFactorRequirementReader } from "./services/two-factor-requirement.service.js";

/** LAX Account's production origin, used for the security-notice link when `LAX_ACCOUNT_ORIGIN` is unset. */
const DEFAULT_LAX_ACCOUNT_ORIGIN = "https://account.lax.bid";

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
const { db, redis, emailSender, productSubjectUsage, webOrigins, envelope, phoneVerification } =
  infra;
try {
  await assertAuthAtRestReady({ db, crypto: envelope, nodeEnv: env.NODE_ENV });
} catch (error) {
  log.fatal({ error }, "auth startup preflight failed");
  await Promise.allSettled([redis.quit(), closeIdentityDb(db)]);
  throw error;
}
const repositories = createAuthRepositories(db);
const identityPorts = createIdentityAuthPorts(db, {
  envelope: envelope ?? undefined,
});
const readTwoFactorRequirement = createTwoFactorRequirementReader(
  identityPorts.twoFactorPolicyStore,
);
const metrics = createAuthMetrics();
const services = createOidcRouteServices({
  db,
  redis,
  issuer: env.OIDC_ISSUER_URL,
  jwks: infra.jwks,
  authSecret: env.BETTER_AUTH_SECRET,
  recentStepUpMaxAgeSec: AUTH_TIMINGS.recentPasswordProofMaxAgeSec,
  environment: env.APP_ENV,
  log,
  onBackchannelOutcome: (outcome) => {
    metrics.backchannelDeliveryOutcomes.inc({ outcome });
    if (outcome !== "delivered") log.warn({ outcome }, "backchannel_logout_delivery_outcome");
  },
});
const accountOrigin = (env.LAX_ACCOUNT_ORIGIN ?? DEFAULT_LAX_ACCOUNT_ORIGIN).replace(/\/+$/, "");
const securityNotices = createSecurityNoticeService({
  db,
  email: emailSender,
  secureAccountUrl: `${accountOrigin}/account/security`,
  cancelDeletionUrl: `${accountOrigin}/account/security/delete`,
  log,
});
const accountAccessClaims = createAccountAccessClaimsResolver({
  store: identityPorts.twoFactorPolicyStore,
});
const refreshedIdTokens = createRefreshedIdTokenService({
  db,
  redis,
  jwks: infra.jwks,
  authSecret: env.BETTER_AUTH_SECRET,
  accessClaims: accountAccessClaims,
  sealer: envelope ?? undefined,
});
const auth = createAuthIssuer({
  env,
  db,
  redis,
  log,
  email: emailSender,
  phoneVerification,
  trustedOrigins: webOrigins,
  logout: services.oidc.logout,
  oidcSessions: services.oidc.sessions,
  accountAccessClaims,
  identityEventPublisher: repositories.identityEventPublisher,
  securityNotices,
});
const identityOperations = createIdentityOperationsService({
  db,
  notices: securityNotices,
  productSubjectUsage,
  identityEventPublisher: repositories.identityEventPublisher,
  logout: services.oidc.logout,
});
const durableSecurityEffects = createDurableSecurityEffects({
  db,
  ports: {
    operations: identityOperations,
    logout: services.oidc.logout,
    events: repositories.identityEventPublisher,
  },
  log: withAlertingLog(log),
});
const emailChange = new EmailChangeService({
  operations: identityOperations,
  email: emailSender,
  notices: securityNotices,
  authSecret: env.BETTER_AUTH_SECRET,
  confirmationPages: {
    bid: `${env.WEB_ORIGIN.replace(/\/+$/, "")}/dashboard/settings/account/confirm`,
    ...(env.LAX_ACCOUNT_ORIGIN
      ? { account: `${env.LAX_ACCOUNT_ORIGIN.replace(/\/+$/, "")}/account/email-change` }
      : {}),
  },
});
const accountDeletion = new AccountDeletionService({
  operations: identityOperations,
  notices: securityNotices,
  products: infra.productDeletionEligibility,
  onProductUnavailable: (product, error) =>
    log.warn({ err: error, product }, "account_deletion_product_unavailable"),
});
const identityLifecycle = createIdentityLifecycleService({
  db,
  identityEventPublisher: repositories.identityEventPublisher,
  logout: services.oidc.logout,
});
const authHandler = createAuthRequestHandler({
  log,
  durable: durableSecurityEffects,
  notices: securityNotices,
  sessionStampStore: identityPorts.sessionStampStore,
  readTwoFactorRequirement,
  auth,
  oidcSessions: services.oidc.sessions,
});
const schedules = await createAuthSchedules({
  db,
  log,
  identityOperations,
  logoutDelivery: services.oidc.logoutDelivery,
  securityEffects: durableSecurityEffects,
  ssfStreams: services.ssf.streams,
  ssfDelivery: services.ssf.delivery,
  ssfEnabled: env.SSF_DELIVERY_ENABLED,
  ssfTimeoutMs: env.SSF_DELIVERY_TIMEOUT_MS,
  ssfMaxAttempts: env.SSF_DELIVERY_MAX_ATTEMPTS,
  onSsfOutcome: (outcome, deliveryId) => {
    metrics.ssfDeliveryOutcomes.inc({ outcome });
    if (outcome !== "delivered") log.warn({ outcome, deliveryId }, "ssf_delivery_outcome");
  },
  reconcileAuthAtRest: () =>
    reconcileAuthAtRestMetric(db, (pending) => metrics.authAtRestPending.set(pending)),
});
const internal =
  env.IDENTITY_MACHINE_CLIENT_ID && env.IDENTITY_MACHINE_CLIENT_SECRET
    ? {
        redis,
        routes: createInternalIdentityRoutes({
          lifecycle: identityLifecycle,
          operations: identityOperations,
          emailChange,
          accountDeletion,
          redis,
          machineClientId: env.IDENTITY_MACHINE_CLIENT_ID,
          machineClientSecret: env.IDENTITY_MACHINE_CLIENT_SECRET,
          allowMerge: env.IDENTITY_MERGE_ENABLED,
          addresses: {
            addresses: createIdentityAddressService(db),
          },
          twoFactorPolicy: {
            store: identityPorts.twoFactorPolicyStore,
            readRequirement: readTwoFactorRequirement,
          },
          onCredentialRateLimitError: (error) => {
            log.warn({ err: error }, "machine_credential_rate_limit_unavailable");
          },
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
    release: env.SENTRY_RELEASE,
    metricsToken: env.METRICS_TOKEN,
    metrics: metrics.registry,
    redis,
    ...(internal ? { internal } : {}),
  },
  oidc: {
    env,
    db,
    sessionStampStore: identityPorts.sessionStampStore,
    readTwoFactorRequirement,
    redis,
    auth,
    webOrigins,
    retryResponseCrypto: envelope,
    refreshFamilies,
    idTokenRenewal: refreshedIdTokens,
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
    identityOperations,
    emailChange,
    accountDeletion,
    emailSender,
    securityNotices,
    durableSecurityEffects,
    phoneVerification,
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
      .then(() => Promise.allSettled([redis.quit(), closeIdentityDb(db)]))
      .finally(() => {
        clearTimeout(timeout);
        process.exit(0);
      });
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
