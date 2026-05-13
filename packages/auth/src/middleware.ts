import { type JWTPayload, createRemoteJWKSet, jwtVerify } from "jose";
import { DEFAULT_JWT_AUDIENCE } from "./auth-timings.js";

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

export type VerifiedToken = {
  payload: JWTPayload;
  subject: string;
};

/** Verify Bearer JWT from the auth issuer. Invalid/expired tokens return `null` (never throw). */
export async function verifyBearerToken(options: {
  authorization: string | null | undefined;
  jwksUrl: string;
  issuer: string;
  /** Required — defaults to {@link DEFAULT_JWT_AUDIENCE}. */
  audience?: string | string[] | undefined;
}): Promise<VerifiedToken | null> {
  const header = options.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const audience = options.audience ?? DEFAULT_JWT_AUDIENCE;
  try {
    const result = await jwtVerify(token, getJwks(options.jwksUrl), {
      issuer: options.issuer,
      audience,
    });
    if (!result.payload.sub) return null;
    return { payload: result.payload, subject: result.payload.sub };
  } catch {
    return null;
  }
}
