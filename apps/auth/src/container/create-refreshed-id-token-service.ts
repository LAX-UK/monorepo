import { AUTH_TIMINGS } from "@auction/auth";
import { ACCESS_TOKEN_TTL_SECONDS } from "@auction/identity-contracts";
import type { IdentityDatabase } from "@auction/identity-db";
import type { Redis } from "ioredis";
import { createIdentityJwtSigner } from "../infrastructure/create-identity-jwt-signer.js";
import { isIdentitySubjectActive } from "../infrastructure/identity-subject-status.js";
import type { JwksProvider } from "../infrastructure/jwks-provider.js";
import { DrizzleOidcRpSessionRepository } from "../infrastructure/oidc-session-adapters.js";
import {
  type ContinuitySealer,
  RedisIdTokenContinuityStore,
} from "../infrastructure/redis-id-token-continuity-store.js";
import { RefreshedIdTokenService } from "../services/refreshed-id-token.service.js";

export function createRefreshedIdTokenService(options: {
  db: IdentityDatabase;
  redis: Redis;
  jwks: JwksProvider;
  authSecret: string;
  accessClaims(input: { subjectId: string; clientId: string }): Promise<Record<string, unknown>>;
  sealer?: ContinuitySealer | undefined;
  now?: () => Date;
}): RefreshedIdTokenService {
  const sessions = new DrizzleOidcRpSessionRepository(options.db);
  const now = options.now ?? (() => new Date());
  return new RefreshedIdTokenService({
    continuity: new RedisIdTokenContinuityStore(options.redis, options.sealer),
    findLiveIdentitySession: (sid) => sessions.findLiveIdentitySession(sid, now()),
    isSubjectActive: (subject) => isIdentitySubjectActive(options.db, subject),
    accessClaims: options.accessClaims,
    signer: createIdentityJwtSigner({ jwks: options.jwks, authSecret: options.authSecret }),
    idTokenTtlSec: ACCESS_TOKEN_TTL_SECONDS,
    continuityTtlSec: AUTH_TIMINGS.oidcRefreshTokenExpiresSec,
  });
}
