import "server-only";

import { randomBytes } from "node:crypto";
import {
  JWKS_PATH,
  LAX_RESOURCES,
  type LaxResourceId,
  normalizeIssuerUrl,
} from "@auction/identity-contracts";
import { verifyIdentityToken } from "@auction/identity-contracts/verify";
import {
  IdentityRejectedError,
  IdentityUnavailableError,
  buildAuthorizeUrl,
  buildEndSessionUrl as buildEndSessionHref,
  createFetchTokenEndpoint,
  generateOAuthLoginParams,
  isIdentityRejected,
  isIdentityUnavailable,
  mergeRefreshTokens,
  validateOAuthStateTimingSafe,
} from "@auction/identity-rp";
import { bffConfig } from "./config.server";
import type { AuthenticatedBidSession } from "./session-store.server";

const ID_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";
const TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";

/** Upper bound for issuer token-endpoint calls from the Bid BFF. */
export const IDENTITY_TOKEN_FETCH_TIMEOUT_MS = 15_000;

export {
  IdentityRejectedError,
  IdentityUnavailableError,
  isIdentityRejected,
  isIdentityUnavailable,
};

function requireTokenExpiresIn(token: { expires_in?: number }): number {
  if (typeof token.expires_in !== "number") {
    throw new IdentityUnavailableError("Identity token endpoint returned an invalid response");
  }
  return token.expires_in;
}

export const createLoginProof = generateOAuthLoginParams;
export const validateCallbackState = validateOAuthStateTimingSafe;

function tokenEndpoint() {
  const config = bffConfig();
  return createFetchTokenEndpoint({
    tokenEndpointUrl: `${config.internalIssuer}/api/auth/oauth2/token`,
    auth: { kind: "basic", clientId: config.clientId, clientSecret: config.clientSecret },
    timeoutMs: IDENTITY_TOKEN_FETCH_TIMEOUT_MS,
  });
}

export function buildAuthorizationUrl(input: {
  state: string;
  nonce: string;
  codeChallenge: string;
}): URL {
  const config = bffConfig();
  const href = buildAuthorizeUrl({
    authorizationEndpoint: new URL("/api/auth/oauth2/authorize", config.issuer).toString(),
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scopes: ["openid", "profile", "email", "offline_access", "bid.read", "bid.write"],
    state: input.state,
    nonce: input.nonce,
    codeChallenge: input.codeChallenge,
  });
  return new URL(href);
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  nonce: string;
}): Promise<AuthenticatedBidSession> {
  const config = bffConfig();
  const token = await tokenEndpoint().requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: config.redirectUri,
      code_verifier: input.codeVerifier,
    }),
  );
  if (!token.id_token || !token.refresh_token) {
    throw new Error("Identity authorization response omitted required tokens");
  }
  const issuer = normalizeIssuerUrl(config.issuer);
  const jwksUrl = `${config.internalIssuer.replace(/\/+$/, "")}${JWKS_PATH}`;
  const verified = await verifyIdentityToken({
    token: token.id_token,
    jwksUrl,
    issuer,
    audience: config.clientId,
  });
  if (!verified) {
    throw new Error("Identity id_token signature or claims are invalid");
  }
  const { payload } = verified;
  if (
    payload.nonce !== input.nonce ||
    typeof payload.sub !== "string" ||
    typeof payload.sid !== "string"
  ) {
    throw new Error("Identity id_token state binding is invalid");
  }
  return {
    kind: "authenticated",
    subject: payload.sub,
    sid: payload.sid,
    idToken: token.id_token,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    accessTokenExpiresAt: Date.now() + requireTokenExpiresIn(token) * 1_000,
    resourceTokens: {},
  };
}

export async function refreshIdentityTokens(
  session: AuthenticatedBidSession,
): Promise<AuthenticatedBidSession> {
  const token = await tokenEndpoint().requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    }),
  );
  const merged = mergeRefreshTokens(
    { refreshToken: session.refreshToken, idToken: session.idToken },
    token,
    "bid",
  );
  return {
    ...session,
    accessToken: token.access_token,
    refreshToken: merged.refreshToken,
    idToken: merged.idToken,
    accessTokenExpiresAt: Date.now() + requireTokenExpiresIn(token) * 1_000,
    resourceTokens: {},
  };
}

export async function exchangeResourceToken(
  session: AuthenticatedBidSession,
  audience: LaxResourceId,
  scopes: string,
): Promise<{ token: string; expiresAt: number; scopes: string }> {
  const resource = LAX_RESOURCES[audience];
  const token = await tokenEndpoint().requestToken(
    new URLSearchParams({
      grant_type: TOKEN_EXCHANGE_GRANT,
      subject_token: session.idToken,
      subject_token_type: ID_TOKEN_TYPE,
      requested_token_type: ACCESS_TOKEN_TYPE,
      resource: resource.uri,
      scope: scopes,
    }),
  );
  const expiresIn = requireTokenExpiresIn(token);
  return { token: token.access_token, expiresAt: Date.now() + expiresIn * 1_000, scopes };
}

export function buildEndSessionUrl(idToken: string): URL {
  const config = bffConfig();
  const href = buildEndSessionHref({
    endSessionEndpoint: new URL("/api/auth/oauth2/endsession", config.issuer).toString(),
    clientId: config.clientId,
    postLogoutRedirectUri: config.postLogoutRedirectUri,
    idTokenHint: idToken,
    state: randomBytes(24).toString("base64url"),
  });
  return new URL(href);
}
