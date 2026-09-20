import { verifyIdentityToken } from "@auction/identity-contracts/verify";
import { buildPgConnectionConfig } from "@auction/identity-db/pg";
import { serve } from "@hono/node-server";
import pg from "pg";
import { completeOAuthCallback } from "./application/complete-oauth-callback.handler.js";
import { createShopIdentityTokenService } from "./application/shop-identity-token.service.js";
import { createShopIdentityApp } from "./create-shop-identity-app.js";
import {
  findShopUserProfile,
  pingShopDatabase,
  upsertShopUserProfile,
} from "./db/shop-profile.repository.js";
import { createPgSessionTokenStore } from "./db/shop-session-token.repository.js";
import { createPgShopSessionRepository } from "./db/shop-session.repository.js";
import { createPgShopSsfRepository } from "./db/shop-ssf.repository.js";
import { loadShopIdentityEnv } from "./env.js";
import { createOidcRefreshClient } from "./infrastructure/oidc-refresh.client.js";
import { clearResourceTokenCacheForSession } from "./infrastructure/shop-api.client.js";
import { createTokenCipher } from "./infrastructure/token-crypto.js";
import {
  checkIdentityProvider,
  decodeJwtPayload,
  exchangeAuthorizationCode,
  resolveJwksUrl,
  resolveOidcDiscovery,
  validateIdTokenClaims,
  verifyLogoutToken,
} from "./oidc.js";
import { startShopRetentionSchedule } from "./retention.schedule.js";

const env = loadShopIdentityEnv();
const release = process.env.SENTRY_RELEASE ?? "unknown";
const databaseUrl = env.DATABASE_URL_SHOP ?? env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL_SHOP is required");
const pool = new pg.Pool(buildPgConnectionConfig(databaseUrl));
const sessionRepository = createPgShopSessionRepository(pool);
const ssfRepository = createPgShopSsfRepository(pool);
const discovery = resolveOidcDiscovery(env.OIDC_ISSUER_URL);
const internalBaseUrl = env.OIDC_INTERNAL_BASE_URL ?? env.OIDC_ISSUER_URL;
const tokenDiscovery = {
  ...discovery,
  token_endpoint: `${internalBaseUrl.replace(/\/+$/, "")}/api/auth/oauth2/token`,
};
const jwksUrl = resolveJwksUrl(internalBaseUrl);
const secureCookies = env.NODE_ENV === "production";
const devTokenEncryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const tokenEncryptionKey =
  env.SHOP_IDENTITY_TOKEN_ENCRYPTION_KEY ??
  (env.NODE_ENV === "production" ? undefined : devTokenEncryptionKey);
if (!tokenEncryptionKey) {
  throw new Error("SHOP_IDENTITY_TOKEN_ENCRYPTION_KEY is required");
}
const tokenStore = createPgSessionTokenStore(pool, createTokenCipher(tokenEncryptionKey));
const tokenService = createShopIdentityTokenService({
  store: tokenStore,
  refresh: createOidcRefreshClient({
    discovery: tokenDiscovery,
    clientId: env.OIDC_CLIENT_ID,
    clientSecret: env.OIDC_CLIENT_SECRET,
  }),
  onRotate: clearResourceTokenCacheForSession,
});
const retentionSchedule = startShopRetentionSchedule({
  pool,
  onError: (error) => console.error("shop_identity_retention_purge_failed", error),
});

const callbackDeps = {
  codeExchanger: {
    exchange: (input: { code: string; codeVerifier: string }) =>
      exchangeAuthorizationCode({
        discovery: tokenDiscovery,
        clientId: env.OIDC_CLIENT_ID,
        clientSecret: env.OIDC_CLIENT_SECRET,
        redirectUri: env.OIDC_REDIRECT_URI,
        ...input,
      }),
  },
  tokenVerifier: {
    decode: decodeJwtPayload,
    validateClaims: (claims: ReturnType<typeof decodeJwtPayload>, expectedNonce: string) =>
      validateIdTokenClaims(claims, {
        issuer: env.OIDC_ISSUER_URL,
        clientId: env.OIDC_CLIENT_ID,
        nonce: expectedNonce,
      }),
    verify: (token: string) =>
      verifyIdentityToken({
        token,
        jwksUrl,
        issuer: discovery.issuer,
        audience: env.OIDC_CLIENT_ID,
      }),
  },
  profiles: {
    upsert: async (input: Parameters<typeof upsertShopUserProfile>[1]) => {
      await upsertShopUserProfile(pool, input);
    },
    find: (identitySubjectId: string) => findShopUserProfile(pool, identitySubjectId),
  },
  sessions: sessionRepository,
};

const app = createShopIdentityApp(
  {
    env,
    release,
    sessionRepository,
    tokenService,
    discovery,
    secureCookies,
    findShopProfile: (identitySubjectId) => findShopUserProfile(pool, identitySubjectId),
    checkDatabase: () => pingShopDatabase(pool),
    checkIdentityProvider: () =>
      checkIdentityProvider(
        env.OIDC_ISSUER_URL,
        fetch,
        env.OIDC_INTERNAL_BASE_URL ?? env.OIDC_ISSUER_URL,
      ),
    completeOAuthCallback: (input) => completeOAuthCallback(callbackDeps, input),
    verifyLogoutToken: (token) =>
      verifyLogoutToken(token, {
        jwksUrl,
        issuer: env.OIDC_ISSUER_URL,
        clientId: env.OIDC_CLIENT_ID,
      }),
  },
  {
    replayStore: ssfRepository,
    issuer: env.OIDC_ISSUER_URL,
    jwksUrl,
  },
);

const server = serve(
  {
    fetch: app.fetch,
    hostname: "0.0.0.0",
    port: env.PORT,
  },
  (info) => {
    console.info(`shop-identity listening on ${info.port}`);
  },
);

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const retentionStopped = retentionSchedule.stop();
  server.close(() => {
    void retentionStopped.then(() => pool.end()).finally(() => process.exit(0));
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
