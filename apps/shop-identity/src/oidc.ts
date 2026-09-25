import {
  JWKS_PATH,
  buildOidcDiscoveryDocument,
  normalizeIssuerUrl,
  validateBackchannelLogoutClaims,
  verifyBackchannelLogoutToken,
} from "@auction/identity-contracts";
import {
  IdentityRejectedError,
  IdentityUnavailableError,
  buildAuthorizeUrl as buildAuthorizeUrlCore,
  buildEndSessionUrl as buildEndSessionHref,
  createFetchTokenEndpoint,
  generateOAuthLoginParams,
  mergeRefreshTokens,
  validateOAuthStateExact,
} from "@auction/identity-rp";
import type { OAuthLoginParams as RpOAuthLoginParams } from "@auction/identity-rp";
import type { JWTPayload } from "jose";

export type OidcDiscovery = ReturnType<typeof buildOidcDiscoveryDocument>;

export type OAuthLoginParams = RpOAuthLoginParams;

export type TokenResponse = {
  id_token: string;
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
};

export { BACKCHANNEL_LOGOUT_EVENT } from "@auction/identity-contracts";
export { IdentityRejectedError, IdentityUnavailableError, generateOAuthLoginParams };

const SHOP_TOKEN_FETCH_TIMEOUT_MS = 15_000;

export function validateLogoutTokenClaims(
  claims: Record<string, unknown>,
  expected: { issuer: string; clientId: string; now?: number; maxAgeSeconds?: number },
): { jti: string; sid?: string; sub?: string; expiresAt: Date } | null {
  return validateBackchannelLogoutClaims(claims as JWTPayload, {
    issuer: expected.issuer,
    audience: expected.clientId,
    ...(expected.now === undefined ? {} : { now: expected.now }),
    ...(expected.maxAgeSeconds === undefined ? {} : { maxAgeSeconds: expected.maxAgeSeconds }),
  });
}

export async function verifyLogoutToken(
  token: string,
  input: { jwksUrl: string; issuer: string; clientId: string },
): ReturnType<typeof verifyBackchannelLogoutToken> {
  return verifyBackchannelLogoutToken({
    token,
    jwksUrl: input.jwksUrl,
    issuer: input.issuer,
    audience: input.clientId,
  });
}

export function resolveOidcDiscovery(issuerUrl: string): OidcDiscovery {
  return buildOidcDiscoveryDocument(normalizeIssuerUrl(issuerUrl));
}

export function resolveJwksUrl(issuerUrl: string): string {
  const issuer = normalizeIssuerUrl(issuerUrl);
  return `${issuer}${JWKS_PATH}`;
}

export async function checkIdentityProvider(
  issuerUrl: string,
  fetchImpl: typeof fetch = fetch,
  internalBaseUrl: string = issuerUrl,
  timeoutMs = 3_000,
): Promise<void> {
  const expected = resolveOidcDiscovery(issuerUrl);
  const response = await fetchImpl(
    `${normalizeIssuerUrl(internalBaseUrl)}/.well-known/openid-configuration`,
    { signal: AbortSignal.timeout(timeoutMs) },
  );
  if (!response.ok) throw new Error(`Identity discovery unavailable (${response.status})`);
  const discovered = (await response.json()) as { issuer?: unknown; jwks_uri?: unknown };
  if (discovered.issuer !== expected.issuer || discovered.jwks_uri !== expected.jwks_uri) {
    throw new Error("Identity discovery contract mismatch");
  }
}

export function buildAuthorizeUrl(input: {
  discovery: OidcDiscovery;
  clientId: string;
  redirectUri: string;
  params: Pick<OAuthLoginParams, "state" | "nonce" | "codeChallenge">;
  scopes?: string[];
  prompt?: string;
}): string {
  return buildAuthorizeUrlCore({
    authorizationEndpoint: input.discovery.authorization_endpoint,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    scopes: input.scopes ?? [
      "openid",
      "profile",
      "email",
      "offline_access",
      "shop.read",
      "shop.write",
    ],
    state: input.params.state,
    nonce: input.params.nonce,
    codeChallenge: input.params.codeChallenge,
    ...(input.prompt ? { prompt: input.prompt } : {}),
  });
}

export function buildEndSessionUrl(input: {
  discovery: OidcDiscovery;
  clientId: string;
  idTokenHint?: string | null;
  postLogoutRedirectUri: string;
  state: string;
}): string {
  return buildEndSessionHref({
    endSessionEndpoint: input.discovery.end_session_endpoint,
    clientId: input.clientId,
    postLogoutRedirectUri: input.postLogoutRedirectUri,
    state: input.state,
    ...(input.idTokenHint ? { idTokenHint: input.idTokenHint } : {}),
  });
}

export const validateOAuthState = validateOAuthStateExact;

export type IdTokenClaims = {
  sub: string;
  iss: string;
  aud: string | string[];
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  sid?: string;
};

export function validateIdTokenClaims(
  claims: IdTokenClaims,
  expected: { issuer: string; clientId: string; nonce: string },
): boolean {
  if (claims.iss !== normalizeIssuerUrl(expected.issuer)) return false;
  if (claims.aud !== expected.clientId) return false;
  if (claims.nonce !== expected.nonce) return false;
  if (!claims.sub) return false;
  return true;
}

function shopTokenEndpoint(input: {
  discovery: OidcDiscovery;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
}) {
  return createFetchTokenEndpoint({
    tokenEndpointUrl: input.discovery.token_endpoint,
    auth: { kind: "body", clientId: input.clientId, clientSecret: input.clientSecret },
    timeoutMs: SHOP_TOKEN_FETCH_TIMEOUT_MS,
    ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
  });
}

export async function exchangeAuthorizationCode(input: {
  discovery: OidcDiscovery;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenResponse> {
  const json = await shopTokenEndpoint(input).requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    }),
  );
  if (!json.id_token) {
    throw new Error("OIDC token exchange response missing id_token");
  }
  return {
    id_token: json.id_token,
    ...(json.access_token !== undefined ? { access_token: json.access_token } : {}),
    ...(json.token_type !== undefined ? { token_type: json.token_type } : {}),
    ...(json.expires_in !== undefined ? { expires_in: json.expires_in } : {}),
    ...(json.refresh_token !== undefined ? { refresh_token: json.refresh_token } : {}),
  };
}

export async function refreshOAuthTokens(input: {
  discovery: OidcDiscovery;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenResponse> {
  const json = await shopTokenEndpoint(input).requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    }),
  );
  const merged = mergeRefreshTokens(
    { refreshToken: input.refreshToken, idToken: json.id_token ?? "" },
    json,
    "shop",
  );
  return {
    id_token: merged.idToken,
    refresh_token: merged.refreshToken,
    ...(json.access_token !== undefined ? { access_token: json.access_token } : {}),
    ...(json.token_type !== undefined ? { token_type: json.token_type } : {}),
    ...(json.expires_in !== undefined ? { expires_in: json.expires_in } : {}),
  };
}

export function decodeJwtPayload(token: string): IdTokenClaims {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid JWT");
  }
  const payload = parts[1];
  if (!payload) {
    throw new Error("Invalid JWT payload");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as IdTokenClaims;
}
