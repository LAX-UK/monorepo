import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { LAX_RESOURCES, type LaxResourceId, normalizeIssuerUrl } from "@auction/identity-contracts";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { bffConfig } from "./config.server";
import type { AuthenticatedBidSession } from "./session-store.server";

const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";
const ID_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";
const TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";

type OidcTokenResponse = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
};

export class IdentityTokenEndpointError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = "IdentityTokenEndpointError";
  }
}

export function createLoginProof(): {
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
} {
  const codeVerifier = randomBytes(32).toString("base64url");
  return {
    state: randomBytes(24).toString("base64url"),
    nonce: randomBytes(24).toString("base64url"),
    codeVerifier,
    codeChallenge: createHash("sha256").update(codeVerifier).digest("base64url"),
  };
}

export function validateCallbackState(expected: string, received: string | null): boolean {
  if (!received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function buildAuthorizationUrl(input: {
  state: string;
  nonce: string;
  codeChallenge: string;
}): URL {
  const config = bffConfig();
  const url = new URL("/api/auth/oauth2/authorize", config.issuer);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "openid profile email offline_access bid.read bid.write",
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  }).toString();
  return url;
}

async function tokenRequest(body: URLSearchParams): Promise<OidcTokenResponse> {
  const config = bffConfig();
  let response: Response;
  try {
    response = await fetch(`${config.internalIssuer}/api/auth/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body,
      cache: "no-store",
    });
  } catch {
    throw new IdentityTokenEndpointError(null, "Identity token endpoint is unavailable");
  }
  if (!response.ok) {
    throw new IdentityTokenEndpointError(
      response.status,
      `Identity token endpoint returned ${response.status}`,
    );
  }
  const token = (await response.json()) as Partial<OidcTokenResponse>;
  if (
    typeof token.access_token !== "string" ||
    typeof token.expires_in !== "number" ||
    token.token_type?.toLowerCase() !== "bearer"
  ) {
    throw new IdentityTokenEndpointError(
      response.status,
      "Identity token endpoint returned an invalid response",
    );
  }
  return token as OidcTokenResponse;
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  nonce: string;
}): Promise<AuthenticatedBidSession> {
  const config = bffConfig();
  const token = await tokenRequest(
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
  const result = await jwtVerify(
    token.id_token,
    createRemoteJWKSet(new URL(`${config.internalIssuer}/.well-known/jwks.json`)),
    {
      issuer,
      audience: config.clientId,
      algorithms: ["RS256"],
    },
  );
  if (
    result.payload.nonce !== input.nonce ||
    typeof result.payload.sub !== "string" ||
    typeof result.payload.sid !== "string"
  ) {
    throw new Error("Identity id_token state binding is invalid");
  }
  return {
    kind: "authenticated",
    subject: result.payload.sub,
    sid: result.payload.sid,
    idToken: token.id_token,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    accessTokenExpiresAt: Date.now() + token.expires_in * 1_000,
    resourceTokens: {},
  };
}

export async function refreshIdentityTokens(
  session: AuthenticatedBidSession,
): Promise<AuthenticatedBidSession> {
  const token = await tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
    }),
  );
  return {
    ...session,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? session.refreshToken,
    idToken: token.id_token ?? session.idToken,
    accessTokenExpiresAt: Date.now() + token.expires_in * 1_000,
    resourceTokens: {},
  };
}

export async function exchangeResourceToken(
  session: AuthenticatedBidSession,
  audience: LaxResourceId,
  scopes: string,
): Promise<{ token: string; expiresAt: number; scopes: string }> {
  const resource = LAX_RESOURCES[audience];
  const token = await tokenRequest(
    new URLSearchParams({
      grant_type: TOKEN_EXCHANGE_GRANT,
      subject_token: session.idToken,
      subject_token_type: ID_TOKEN_TYPE,
      requested_token_type: ACCESS_TOKEN_TYPE,
      resource: resource.uri,
      scope: scopes,
    }),
  );
  return { token: token.access_token, expiresAt: Date.now() + token.expires_in * 1_000, scopes };
}

export function buildEndSessionUrl(idToken: string): URL {
  const config = bffConfig();
  const url = new URL("/api/auth/oauth2/endsession", config.issuer);
  url.search = new URLSearchParams({
    id_token_hint: idToken,
    client_id: config.clientId,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    state: randomBytes(24).toString("base64url"),
  }).toString();
  return url;
}
