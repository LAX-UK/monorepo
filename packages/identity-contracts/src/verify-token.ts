import {
  type JWTPayload,
  createRemoteJWKSet,
  decodeProtectedHeader,
  errors,
  jwtVerify,
} from "jose";
import { DEFAULT_JWT_AUDIENCE } from "./claims.js";

/**
 * One interval bounds both refetching and staleness: the key set is refetched at most once per
 * interval, so a key the issuer retires stops verifying within that interval and an unknown
 * `kid` triggers at most one refetch per interval.
 */
const JWKS_REFRESH_INTERVAL_MS = 30_000;

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(url: string) {
  const cached = jwksCache.get(url);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(new URL(url), {
    cacheMaxAge: JWKS_REFRESH_INTERVAL_MS,
    cooldownDuration: JWKS_REFRESH_INTERVAL_MS,
  });
  jwksCache.set(url, jwks);
  return jwks;
}

export type VerifiedIdentityToken = {
  payload: JWTPayload;
  subject: string;
};

/** Verify an Identity-issued JWT. Invalid/expired tokens return `null` (never throw). */
export async function verifyIdentityToken(options: {
  token: string;
  jwksUrl: string;
  issuer: string;
  /** Defaults to {@link DEFAULT_JWT_AUDIENCE}. */
  audience?: string | string[] | undefined;
}): Promise<VerifiedIdentityToken | null> {
  const token = options.token.trim();
  if (!token) return null;

  const audience = options.audience ?? DEFAULT_JWT_AUDIENCE;
  try {
    const result = await jwtVerify(token, getJwks(options.jwksUrl), {
      issuer: options.issuer,
      audience,
      algorithms: ["RS256"],
    });
    if (!result.payload.sub) return null;
    if (
      typeof audience === "string"
        ? result.payload.aud !== audience
        : typeof result.payload.aud !== "string" || !audience.includes(result.payload.aud)
    ) {
      return null;
    }
    return { payload: result.payload, subject: result.payload.sub };
  } catch {
    return null;
  }
}

/**
 * Whether the key that signed `token` is still published by the issuer.
 *
 * An unknown `kid` makes the key set refetch at most once per cooldown, so a freshly
 * rotated key is picked up and a retired one is detected. Returns `false` only when the
 * issuer's key set (after that refetch) no longer contains the key, so callers can drop
 * tokens tied to a retired key instead of serving them until expiry. When the key set
 * cannot be reached the answer is `true`: availability of the issuer must not invalidate
 * otherwise healthy tokens, and the resource server still verifies every request.
 */
export async function isSigningKeyCurrent(options: {
  token: string;
  jwksUrl: string;
}): Promise<boolean> {
  let header: ReturnType<typeof decodeProtectedHeader>;
  try {
    header = decodeProtectedHeader(options.token);
  } catch {
    return false;
  }
  if (!header.kid || header.alg !== "RS256") return false;
  try {
    await getJwks(options.jwksUrl)(header);
    return true;
  } catch (error) {
    return !(error instanceof errors.JWKSNoMatchingKey);
  }
}
