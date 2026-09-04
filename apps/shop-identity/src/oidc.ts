import { createHash, randomBytes } from "node:crypto";
import {
  JWKS_PATH,
  buildOidcDiscoveryDocument,
  normalizeIssuerUrl,
  validateBackchannelLogoutClaims,
  verifyBackchannelLogoutToken,
} from "@auction/identity-contracts";
import type { JWTPayload } from "jose";

export type OidcDiscovery = ReturnType<typeof buildOidcDiscoveryDocument>;

export type OAuthLoginParams = {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
};

export type TokenResponse = {
  id_token: string;
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
};

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

export { BACKCHANNEL_LOGOUT_EVENT } from "@auction/identity-contracts";

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

function base64UrlEncode(input: Buffer): string {
  return input.toString("base64url");
}

export function generateOAuthLoginParams(): OAuthLoginParams {
  const state = base64UrlEncode(randomBytes(24));
  const nonce = base64UrlEncode(randomBytes(24));
  const codeVerifier = base64UrlEncode(randomBytes(32));
  const codeChallenge = base64UrlEncode(createHash("sha256").update(codeVerifier).digest());
  return { state, nonce, codeVerifier, codeChallenge };
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
): Promise<void> {
  const expected = resolveOidcDiscovery(issuerUrl);
  const response = await fetchImpl(
    `${normalizeIssuerUrl(internalBaseUrl)}/.well-known/openid-configuration`,
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
}): string {
  const url = new URL(input.discovery.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", (input.scopes ?? ["openid", "profile", "email"]).join(" "));
  url.searchParams.set("state", input.params.state);
  url.searchParams.set("nonce", input.params.nonce);
  url.searchParams.set("code_challenge", input.params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function buildEndSessionUrl(input: {
  discovery: OidcDiscovery;
  clientId: string;
  postLogoutRedirectUri: string;
  state: string;
}): string {
  const url = new URL(input.discovery.end_session_endpoint);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("post_logout_redirect_uri", input.postLogoutRedirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function validateOAuthState(
  expectedState: string | undefined,
  receivedState: string | null,
): boolean {
  if (!expectedState || !receivedState) return false;
  return expectedState === receivedState;
}

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

export async function exchangeAuthorizationCode(input: {
  discovery: OidcDiscovery;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenResponse> {
  const fetchFn = input.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code_verifier: input.codeVerifier,
  });
  const response = await fetchFn(input.discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OIDC token exchange failed (${response.status}): ${detail}`);
  }
  const json = (await response.json()) as TokenResponse;
  if (!json.id_token) {
    throw new Error("OIDC token exchange response missing id_token");
  }
  return json;
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
