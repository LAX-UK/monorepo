import { type JWTPayload, createRemoteJWKSet, jwtVerify } from "jose";
import { DEFAULT_JWT_AUDIENCE } from "./claims.js";

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
