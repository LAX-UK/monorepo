import {
  AUTH_RATE_LIMIT_POLICY,
  type EmailSender,
  type SecurityNoticePublisher,
  type SessionStampStore,
  type SmsSender,
  type createAuth,
  createAuthNoStoreMiddleware,
  runSignInTurnstileGate,
  stampLastPasswordAuthFromSignInResponse,
} from "@auction/auth";
import {
  FIRST_PARTY_SSF_EVENT_TYPES,
  buildOidcDiscoveryDocument,
} from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import type { Hono } from "hono";
import { cors } from "hono/cors";
import type { Redis } from "ioredis";
import type pino from "pino";
import type { AuthAppEnv } from "../env.js";
import { withAlertingLog } from "../infrastructure/alerting-log.js";
import type { ClientIpResolver } from "../infrastructure/client-ip.js";
import { readAccountSecurityBaseFacts } from "../infrastructure/drizzle-account-security-facts.reader.js";
import { DrizzleOidcRpSessionRepository } from "../infrastructure/oidc-session-adapters.js";
import { createTwoFactorAuthorizeGateMiddleware } from "../infrastructure/two-factor-authorize-gate.middleware.js";
import {
  createAuthIssuerRateLimitMiddleware,
  createMagicLinkIssuerRateLimitMiddleware,
  createSendVerificationIssuerRateLimitMiddleware,
} from "../middleware/auth-rate-limit.js";
import { createAuthRouteCorsMiddleware } from "../middleware/auth-route-cors.js";
import { createIdTokenRenewalMiddleware } from "../middleware/id-token-renewal.js";
import {
  createOAuthTokenRequestContextMiddleware,
  getOAuthTokenRequestContext,
} from "../middleware/oauth-token-request-context.js";
import { createOidcClientPolicyMiddleware } from "../middleware/oidc-client-policy.js";
import {
  type RefreshReplayRedis,
  createRefreshReplayGateMiddleware,
} from "../middleware/refresh-replay-gate.js";
import { createResilientSlidingWindowStore } from "../middleware/resilient-sliding-window-store.js";
import { createAccountAddressRoutes } from "../routes/account-addresses.routes.js";
import { createAccountBackupCodesRoutes } from "../routes/account-backup-codes.routes.js";
import { createAccountContactRoutes } from "../routes/account-contact.routes.js";
import { createAccountDeletionRoutes } from "../routes/account-deletion.routes.js";
import { createAccountIdentityRoutes } from "../routes/account-identity.routes.js";
import { createAccountSecurityFactsRoutes } from "../routes/account-security-facts.routes.js";
import { createOauthTokenManagementRoutes } from "../routes/oauth-token-management.routes.js";
import { createRpInitiatedLogoutRoutes } from "../routes/rp-initiated-logout.routes.js";
import { createSsfRoutes } from "../routes/ssf.routes.js";
import { createTokenExchangeRoutes } from "../routes/token-exchange.routes.js";
import { AccountBackupCodesService } from "../services/account-backup-codes.service.js";
import { AccountContactService } from "../services/account-contact.service.js";
import type { AccountDeletionService } from "../services/account-deletion.service.js";
import { AccountIdentityService } from "../services/account-identity.service.js";
import { AccountPhoneService } from "../services/account-phone.service.js";
import { AccountSecurityFactsService } from "../services/account-security-facts.service.js";
import type { DurableSecurityEffects } from "../services/durable-security-effects.js";
import type { EmailChangeService } from "../services/email-change.service.js";
import type { IdentityOperationsService } from "../services/identity-operations.service.js";
import { RecentSessionGuard } from "../services/recent-session-guard.js";
import type { IRefreshTokenFamilyRepository } from "../services/refresh-token-family.ports.js";
import type { RefreshedIdTokenService } from "../services/refreshed-id-token.service.js";
import { createSubjectReadRateLimiter } from "../services/subject-read-rate-limiter.js";
import type { TwoFactorRequirementReader } from "../services/two-factor-requirement.service.js";
import type { AuthRouteServicesSlice } from "./auth-container-slices.js";
import type { AuthRequestHandler } from "./create-auth-request-handler.js";
import { createIdentityAddressService } from "./create-identity-address-service.js";

type Counter = { inc(labels: Record<string, string>): void };

export type OidcRouteMountOptions = {
  env: AuthAppEnv;
  db: IdentityDatabase;
  sessionStampStore: SessionStampStore;
  readTwoFactorRequirement: TwoFactorRequirementReader;
  redis: Redis;
  log: pino.Logger;
  auth: ReturnType<typeof createAuth>;
  webOrigins: string[];
  retryResponseCrypto?: { seal(value: string): string; open(value: string): string } | undefined;
  refreshFamilies: IRefreshTokenFamilyRepository;
  /** Renews the ID token on refresh, so clients never hold an expired one after rotating. */
  idTokenRenewal: Pick<RefreshedIdTokenService, "rememberIssued" | "renew">;
  replay: RefreshReplayRedis;
  clientIp: ClientIpResolver;
  services: AuthRouteServicesSlice;
  identityOperations: IdentityOperationsService;
  emailChange: EmailChangeService;
  accountDeletion: AccountDeletionService;
  emailSender: EmailSender;
  securityNotices: SecurityNoticePublisher;
  durableSecurityEffects: Pick<DurableSecurityEffects, "settle">;
  /** The SMS provider the phone plugin sends through; the console in development. */
  phoneVerification: SmsSender;
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
    createTwoFactorAuthorizeGateMiddleware({
      auth: options.auth,
      db: options.db,
      sessions: new DrizzleOidcRpSessionRepository(options.db),
      readRequirement: options.readTwoFactorRequirement,
      issuerOrigin: issuer,
    }),
  );
  app.use("/api/auth/*", createAuthRouteCorsMiddleware(options.webOrigins));
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
  // Inside the replay gate, so a refresh retried within its grace window replays the renewed token.
  app.use(
    "/api/auth/*",
    createIdTokenRenewalMiddleware({
      renewal: options.idTokenRenewal,
      onOutcome: (outcome, error) => {
        if (outcome === "failed") options.log.warn({ err: error }, "id_token_renewal_failed");
      },
    }),
  );
  app.use("/api/auth/*", createAuthNoStoreMiddleware());
  const rateLimitStore = createResilientSlidingWindowStore(
    options.redis,
    withAlertingLog(options.log),
  );
  app.use(
    "/api/auth/*",
    createSendVerificationIssuerRateLimitMiddleware(rateLimitStore, options.clientIp),
  );
  app.use(
    "/api/auth/*",
    createAuthIssuerRateLimitMiddleware(rateLimitStore, options.clientIp, {
      resolveSubjectId: async (headers) => {
        const session = await options.auth.api.getSession({ headers });
        return session?.user?.id ?? null;
      },
    }),
  );
  app.use(
    "/api/auth/*",
    createMagicLinkIssuerRateLimitMiddleware(rateLimitStore, options.clientIp),
  );
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
  const accountSecurityFacts = new AccountSecurityFactsService(
    {
      readBaseFacts: (subjectId) => readAccountSecurityBaseFacts(options.db, subjectId),
      // Better Auth decrypts the stored codes (and the at-rest envelope beneath them); only
      // the length leaves this closure.
      countBackupCodes: async (subjectId) =>
        (await options.auth.api.viewBackupCodes({ body: { userId: subjectId } })).backupCodes
          .length,
    },
    (error) => options.log.warn({ err: error }, "account_backup_code_count_failed"),
  );
  app.route(
    "/api/auth",
    createAccountSecurityFactsRoutes({
      clients: services.oidc.confidentialClients,
      tokens: services.oidc.tokenManagement,
      facts: accountSecurityFacts,
      rateLimit: createSubjectReadRateLimiter({
        redis: options.redis,
        keyPrefix: "rl:auth-issuer:account-security-facts",
        windowSec: 60,
        max: 60,
        onError: (error) =>
          options.log.warn({ err: error }, "account_facts_rate_limit_unavailable"),
      }),
      onReadFailure: (error) => options.log.error({ err: error }, "account_security_facts_failed"),
    }),
  );
  const accountRateLimit = (name: string, max: number) =>
    createSubjectReadRateLimiter({
      redis: options.redis,
      keyPrefix: `rl:auth-issuer:${name}`,
      windowSec: 60,
      max,
      onError: (error) =>
        options.log.warn({ err: error }, "account_identity_rate_limit_unavailable"),
    });
  app.route(
    "/api/auth",
    createAccountIdentityRoutes({
      clients: services.oidc.confidentialClients,
      tokens: services.oidc.tokenManagement,
      identity: new AccountIdentityService({
        operations: options.identityOperations,
        durable: options.durableSecurityEffects,
      }),
      readRateLimit: accountRateLimit("account-identity-read", 120),
      writeRateLimit: accountRateLimit("account-identity-write", 20),
      onFailure: (error) => options.log.error({ err: error }, "account_identity_request_failed"),
    }),
  );
  app.route(
    "/api/auth",
    createAccountAddressRoutes({
      clients: services.oidc.confidentialClients,
      tokens: services.oidc.tokenManagement,
      addresses: createIdentityAddressService(options.db),
      sessions: new RecentSessionGuard(options.identityOperations),
      readRateLimit: accountRateLimit("account-addresses-read", 120),
      writeRateLimit: accountRateLimit("account-addresses-write", 20),
      onFailure: (error) => options.log.error({ err: error }, "account_addresses_request_failed"),
    }),
  );
  app.route(
    "/api/auth",
    createAccountBackupCodesRoutes({
      clients: services.oidc.confidentialClients,
      tokens: services.oidc.tokenManagement,
      backupCodes: new AccountBackupCodesService({
        operations: options.identityOperations,
        // Better Auth generates, encrypts and stores the codes; only the new set leaves it.
        regenerate: async (subjectId) =>
          (await options.auth.api.regenerateBackupCodes({ body: { userId: subjectId } }))
            .backupCodes,
        notices: options.securityNotices,
      }),
      // Each regeneration ends the old codes, so it is capped well below the other changes.
      rateLimit: createSubjectReadRateLimiter({
        redis: options.redis,
        keyPrefix: "rl:auth-issuer:account-backup-codes",
        windowSec: 3600,
        max: 10,
        failClosed: true,
        onError: (error) =>
          options.log.warn({ err: error }, "account_backup_codes_rate_limit_unavailable"),
      }),
      onFailure: (error) => options.log.error({ err: error }, "account_backup_codes_failed"),
    }),
  );
  const phoneRules = AUTH_RATE_LIMIT_POLICY;
  const strictRateLimit = (name: string, windowSec: number, max: number) =>
    createSubjectReadRateLimiter({
      redis: options.redis,
      keyPrefix: `rl:auth-issuer:${name}`,
      windowSec,
      max,
      // A code is a paid SMS and the code space is small: with Redis down, refuse rather than
      // allow unlimited sends or guesses.
      failClosed: true,
      onError: (error) =>
        options.log.warn({ err: error }, "account_contact_rate_limit_unavailable"),
    });
  app.route(
    "/api/auth",
    createAccountContactRoutes({
      clients: services.oidc.confidentialClients,
      tokens: services.oidc.tokenManagement,
      contact: new AccountContactService({
        operations: options.identityOperations,
        emailChange: options.emailChange,
      }),
      phone: new AccountPhoneService({
        operations: options.identityOperations,
        sms: options.phoneVerification,
        notices: options.securityNotices,
      }),
      emailChange: options.emailChange,
      readRateLimit: accountRateLimit("account-contact-read", 120),
      // Each start sends two emails, to an address the person typed.
      emailChangeRateLimit: strictRateLimit("account-email-change", 60 * 60, 5),
      phoneSendRateLimit: strictRateLimit(
        "account-phone-send",
        phoneRules.phoneSendOtpSubjectWindowSec,
        phoneRules.phoneSendOtpSubjectMax,
      ),
      phoneNumberRateLimit: strictRateLimit(
        "account-phone-number",
        phoneRules.phoneSendOtpNumberWindowSec,
        phoneRules.phoneSendOtpNumberMax,
      ),
      phoneVerifyRateLimit: strictRateLimit(
        "account-phone-verify",
        phoneRules.phoneVerifySubjectWindowSec,
        phoneRules.phoneVerifySubjectMax,
      ),
      onFailure: (error) => options.log.error({ err: error }, "account_contact_request_failed"),
    }),
  );
  app.route(
    "/api/auth",
    createAccountDeletionRoutes({
      clients: services.oidc.confidentialClients,
      tokens: services.oidc.tokenManagement,
      deletion: options.accountDeletion,
      // Each read asks every product, so it gets a smaller budget than other reads.
      statusRateLimit: accountRateLimit("account-deletion-status", 30),
      changeRateLimit: strictRateLimit("account-deletion-change", 60 * 60, 10),
      onFailure: (error) => options.log.error({ err: error }, "account_deletion_request_failed"),
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
  app.route(
    "/api/auth",
    createRpInitiatedLogoutRoutes({
      authHandler: options.authHandler,
      verifier: services.oidc.rpInitiatedLogout,
      revokeIdentitySession: (sessionId) =>
        services.oidc.logout.revokeIdentitySessions([sessionId]),
      currentSession: async (headers) => {
        const session = await options.auth.api.getSession({ headers });
        const subjectId = session?.user?.id;
        const sessionId = session?.session?.id;
        if (!subjectId || !sessionId) return null;
        return { subjectId, sessionId };
      },
    }),
  );
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
