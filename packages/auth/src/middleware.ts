import { type JWTPayload, createRemoteJWKSet, jwtVerify } from "jose";

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

export async function verifyBearerToken(options: {
  authorization: string | null | undefined;
  jwksUrl: string;
  issuer: string;
  audience?: string | string[] | undefined;
}): Promise<VerifiedToken | null> {
  const header = options.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const verifyOptions = {
    issuer: options.issuer,
    ...(options.audience ? { audience: options.audience } : {}),
  };
  const result = await jwtVerify(token, getJwks(options.jwksUrl), verifyOptions);
  if (!result.payload.sub) return null;
  return { payload: result.payload, subject: result.payload.sub };
}
