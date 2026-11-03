import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";

/** Compares digests so neither the content nor the length of the secret is revealed by timing. */
function sameSecret(supplied: unknown, expected: string): boolean {
  if (typeof supplied !== "string") return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(expected));
}

/**
 * Whether the caller holds the machine credential: 503 when it is not configured (the boundary is
 * closed, not open), 401 when the id, secret or, if one is required, the scope does not match.
 */
export function machineCallerStatus(
  request: FastifyRequest,
  machine: { clientId: string | undefined; clientSecret: string | undefined },
  requiredScope?: string,
): 200 | 401 | 503 {
  if (!machine.clientId || !machine.clientSecret) return 503;
  const authorised =
    sameSecret(request.headers["x-identity-client-id"], machine.clientId) &&
    sameSecret(request.headers["x-identity-client-secret"], machine.clientSecret) &&
    (requiredScope === undefined || request.headers["x-identity-client-scope"] === requiredScope);
  return authorised ? 200 : 401;
}
