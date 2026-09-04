import { randomBytes } from "node:crypto";
import { verifyIdentityToken } from "@auction/identity-contracts/verify";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import pg from "pg";
import {
  findShopUserProfile,
  pingShopDatabase,
  upsertShopUserProfile,
} from "./db/shop-profile.repository.js";
import { createPgShopSessionRepository } from "./db/shop-session.repository.js";
import { createPgShopSsfRepository } from "./db/shop-ssf.repository.js";
import { loadShopIdentityEnv } from "./env.js";
import {
  buildAuthorizeUrl,
  buildEndSessionUrl,
  checkIdentityProvider,
  decodeJwtPayload,
  exchangeAuthorizationCode,
  generateOAuthLoginParams,
  resolveJwksUrl,
  resolveOidcDiscovery,
  validateIdTokenClaims,
  validateOAuthState,
  verifyLogoutToken,
} from "./oidc.js";
import { startShopRetentionSchedule } from "./retention.schedule.js";
import { clearSessionCookie, readSession, readSessionId, writeSessionCookie } from "./session.js";
import { createShopSsfEventsRoute } from "./ssf.js";

const env = loadShopIdentityEnv();
const pool = new pg.Pool({ connectionString: env.DATABASE_URL_SHOP ?? env.DATABASE_URL });
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
const retentionSchedule = startShopRetentionSchedule({
  pool,
  onError: (error) => console.error("shop_identity_retention_purge_failed", error),
});

const app = new Hono();

app.route(
  "/api/ssf/events",
  createShopSsfEventsRoute({
    replayStore: ssfRepository,
    issuer: env.OIDC_ISSUER_URL,
    jwksUrl,
  }),
);

app.get("/health/live", (c) => c.json({ service: "shop-identity", status: "ok" }));
app.get("/health/ready", async (c) => {
  try {
    await pingShopDatabase(pool);
    await checkIdentityProvider(env.OIDC_ISSUER_URL, fetch, internalBaseUrl);
    return c.json({
      service: "shop-identity",
      status: "ok",
      database: "ok",
      identity: "ok",
    });
  } catch {
    return c.json({ service: "shop-identity", status: "degraded" }, 503);
  }
});

app.get("/", async (c) => {
  const session = await readSession(sessionRepository, c);
  return c.redirect(session?.subject ? "/me" : "/login", 302);
});

app.get("/login", async (c) => {
  const oauth = generateOAuthLoginParams();
  const sessionId = await sessionRepository.createPendingOAuth(oauth);
  writeSessionCookie(c, sessionId, {
    maxAgeSeconds: 60 * 10,
    secure: secureCookies,
  });
  const authorizeUrl = buildAuthorizeUrl({
    discovery,
    clientId: env.OIDC_CLIENT_ID,
    redirectUri: env.OIDC_REDIRECT_URI,
    params: oauth,
  });
  return c.redirect(authorizeUrl, 302);
});

app.get("/auth/callback", async (c) => {
  const session = await readSession(sessionRepository, c);
  const pending = session?.oauth;
  if (!pending) {
    return c.text("Missing OAuth session", 400);
  }

  const receivedState = c.req.query("state") ?? null;
  if (!validateOAuthState(pending.state, receivedState)) {
    return c.text("Invalid OAuth state", 400);
  }

  const code = c.req.query("code");
  if (!code) {
    const error = c.req.query("error") ?? "unknown";
    return c.text(`OAuth authorization failed: ${error}`, 400);
  }

  let tokenResponse: Awaited<ReturnType<typeof exchangeAuthorizationCode>>;
  try {
    tokenResponse = await exchangeAuthorizationCode({
      discovery: tokenDiscovery,
      clientId: env.OIDC_CLIENT_ID,
      clientSecret: env.OIDC_CLIENT_SECRET,
      redirectUri: env.OIDC_REDIRECT_URI,
      code,
      codeVerifier: pending.codeVerifier,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    return c.text(message, 502);
  }

  const decodedClaims = decodeJwtPayload(tokenResponse.id_token);
  if (
    !validateIdTokenClaims(decodedClaims, {
      issuer: env.OIDC_ISSUER_URL,
      clientId: env.OIDC_CLIENT_ID,
      nonce: pending.nonce,
    })
  ) {
    return c.text("Invalid id_token claims", 401);
  }

  const verified = await verifyIdentityToken({
    token: tokenResponse.id_token,
    jwksUrl,
    issuer: discovery.issuer,
    audience: env.OIDC_CLIENT_ID,
  });
  if (!verified) {
    return c.text("Invalid id_token signature", 401);
  }

  const email =
    typeof verified.payload.email === "string"
      ? verified.payload.email
      : (decodedClaims.email ?? null);
  const name =
    typeof verified.payload.name === "string"
      ? verified.payload.name
      : (decodedClaims.name ?? null);

  await upsertShopUserProfile(pool, {
    identitySubjectId: verified.subject,
    email,
    name,
  });

  const sid = typeof verified.payload.sid === "string" ? verified.payload.sid : null;
  if (!sid || !session) {
    return c.text("id_token is missing required sid", 401);
  }
  await sessionRepository.authenticate({
    id: session.id,
    subject: verified.subject,
    sid,
  });
  return c.redirect("/", 302);
});

app.get("/me", async (c) => {
  const session = await readSession(sessionRepository, c);
  if (!session?.subject) {
    return c.json({ authenticated: false }, 401);
  }
  const profile = await findShopUserProfile(pool, session.subject);
  if (!profile || profile.disabledAt) {
    await sessionRepository.invalidate(session.id);
    clearSessionCookie(c);
    return c.json({ authenticated: false, reason: "identity_disabled" }, 403);
  }
  return c.json({
    authenticated: true,
    subject: session.subject,
    profile,
  });
});

app.post("/api/auth/backchannel-logout", async (c) => {
  if (!(c.req.header("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    return c.json({ error: "invalid_request" }, 400);
  }
  const params = new URLSearchParams(await c.req.text());
  if (params.getAll("logout_token").length !== 1) {
    return c.json({ error: "invalid_request" }, 400);
  }
  const token = params.get("logout_token");
  if (!token) return c.json({ error: "invalid_request" }, 400);
  const claims = await verifyLogoutToken(token, {
    jwksUrl,
    issuer: env.OIDC_ISSUER_URL,
    clientId: env.OIDC_CLIENT_ID,
  });
  if (!claims) return c.json({ error: "invalid_logout_token" }, 400);
  const consumed = await sessionRepository.consumeLogoutToken(claims);
  if (consumed === "replay") return c.json({ error: "logout_token_replay" }, 400);
  return c.body(null, 200);
});

app.post("/logout", async (c) => {
  const session = await readSession(sessionRepository, c);
  const sessionId = session?.id ?? readSessionId(c);
  await sessionRepository.invalidate(sessionId);
  clearSessionCookie(c);
  const state = randomBytes(24).toString("base64url");
  return c.redirect(
    buildEndSessionUrl({
      discovery,
      clientId: env.OIDC_CLIENT_ID,
      postLogoutRedirectUri: env.OIDC_POST_LOGOUT_REDIRECT_URI,
      state,
    }),
    303,
  );
});

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
