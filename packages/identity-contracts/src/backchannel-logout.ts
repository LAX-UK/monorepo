import { type JWTPayload, createRemoteJWKSet, jwtVerify } from "jose";
import { normalizeIssuerUrl } from "./discovery.js";

export const BACKCHANNEL_LOGOUT_EVENT =
  "http://schemas.openid.net/event/backchannel-logout" as const;
export const BACKCHANNEL_LOGOUT_TOKEN_TYPE = "logout+jwt" as const;
export const BACKCHANNEL_LOGOUT_MAX_AGE_SECONDS = 5 * 60;

export type ValidatedBackchannelLogoutClaims = {
  jti: string;
  sid?: string;
  sub?: string;
  expiresAt: Date;
};

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(url: string) {
  const cached = jwksCache.get(url);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(new URL(url), {
    cacheMaxAge: 10 * 60 * 1000,
    cooldownDuration: 30_000,
  });
  jwksCache.set(url, jwks);
  return jwks;
}

export function validateBackchannelLogoutClaims(
  claims: JWTPayload,
  expected: {
    issuer: string;
    audience: string;
    now?: number | undefined;
    maxAgeSeconds?: number | undefined;
  },
): ValidatedBackchannelLogoutClaims | null {
  const now = expected.now ?? Math.floor(Date.now() / 1_000);
  const maxAge = expected.maxAgeSeconds ?? BACKCHANNEL_LOGOUT_MAX_AGE_SECONDS;
  if (
    claims.iss !== normalizeIssuerUrl(expected.issuer) ||
    claims.aud !== expected.audience ||
    typeof claims.iat !== "number" ||
    claims.iat > now + 30 ||
    claims.iat < now - maxAge ||
    typeof claims.jti !== "string" ||
    claims.jti.length === 0 ||
    "nonce" in claims
  ) {
    return null;
  }

  const events = claims.events;
  if (
    !events ||
    typeof events !== "object" ||
    Array.isArray(events) ||
    Object.keys(events).length !== 1 ||
    !(BACKCHANNEL_LOGOUT_EVENT in events)
  ) {
    return null;
  }
  const event = (events as Record<string, unknown>)[BACKCHANNEL_LOGOUT_EVENT];
  if (
    !event ||
    typeof event !== "object" ||
    Array.isArray(event) ||
    Object.keys(event).length !== 0
  ) {
    return null;
  }

  const sid = typeof claims.sid === "string" && claims.sid.length > 0 ? claims.sid : undefined;
  const sub = typeof claims.sub === "string" && claims.sub.length > 0 ? claims.sub : undefined;
  if (!sid && !sub) return null;
  return {
    jti: claims.jti,
    ...(sid ? { sid } : {}),
    ...(sub ? { sub } : {}),
    expiresAt: new Date((claims.iat + maxAge) * 1_000),
  };
}

export async function verifyBackchannelLogoutToken(options: {
  token: string;
  jwksUrl: string;
  issuer: string;
  audience: string;
  now?: number | undefined;
  maxAgeSeconds?: number | undefined;
}): Promise<ValidatedBackchannelLogoutClaims | null> {
  const token = options.token.trim();
  if (!token) return null;
  const issuer = normalizeIssuerUrl(options.issuer);
  const maxAgeSeconds = options.maxAgeSeconds ?? BACKCHANNEL_LOGOUT_MAX_AGE_SECONDS;
  try {
    const { payload } = await jwtVerify(token, getJwks(options.jwksUrl), {
      issuer,
      audience: options.audience,
      algorithms: ["RS256"],
      typ: BACKCHANNEL_LOGOUT_TOKEN_TYPE,
      maxTokenAge: `${maxAgeSeconds}s`,
      ...(options.now ? { currentDate: new Date(options.now * 1_000) } : {}),
    });
    return validateBackchannelLogoutClaims(payload, {
      issuer,
      audience: options.audience,
      ...(options.now === undefined ? {} : { now: options.now }),
      maxAgeSeconds,
    });
  } catch {
    return null;
  }
}
