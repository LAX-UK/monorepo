import { type UserRole, normalizeUserRoleOrClient } from "@auction/types";
import { createRemoteJWKSet, jwtVerify } from "jose";

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

export async function verifySocketToken(options: {
  token: string | undefined;
  issuer: string;
  jwksUrl: string;
}): Promise<{ id: string; role: UserRole } | null> {
  if (!options.token) return null;
  const result = await jwtVerify(options.token, getJwks(options.jwksUrl), {
    issuer: options.issuer,
  });
  if (!result.payload.sub) return null;
  return {
    id: result.payload.sub,
    role: normalizeUserRoleOrClient(String(result.payload.role ?? "client")),
  };
}
