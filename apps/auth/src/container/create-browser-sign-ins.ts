import type { IdentityDatabase } from "@auction/identity-db";
import type { Redis } from "ioredis";
import { DrizzleBrowserSignOutStore } from "../infrastructure/drizzle-browser-sign-out.store.js";
import { DrizzleOAuthTokenSignInStore } from "../infrastructure/drizzle-oauth-token-sign-in.store.js";
import { DrizzleSessionActivityStore } from "../infrastructure/drizzle-session-activity.store.js";
import { DrizzleSessionExpiryStore } from "../infrastructure/drizzle-session-expiry.store.js";
import { DrizzleOidcRpSessionRepository } from "../infrastructure/oidc-session-adapters.js";
import {
  type ContinuitySealer,
  RedisIdTokenContinuityStore,
} from "../infrastructure/redis-id-token-continuity-store.js";
import type { BackchannelLogoutRevoker } from "../services/backchannel-logout.service.js";
import { BrowserSignOutService } from "../services/browser-sign-out.service.js";
import type { DurableSecurityEffects } from "../services/durable-security-effects.js";
import { OAuthTokenSignInBinding } from "../services/oauth-token-sign-in-binding.service.js";
import { SignInLivenessGuard } from "../services/refresh-sign-in-guard.js";
import { SessionActivity } from "../services/session-activity.service.js";
import { SessionExpirySweep } from "../services/session-expiry-sweep.service.js";

const SIGN_OUT_PATH = "browser-sign-out";
const EXPIRY_PATH = "session-expiry";

/**
 * Everything that ties OAuth tokens to the sign-in they were issued under: signing out of one
 * browser, refusing refresh once the sign-in is over, and sweeping sign-ins that ran out.
 */
export function createBrowserSignIns(options: {
  db: IdentityDatabase;
  redis: Redis;
  sealer?: ContinuitySealer | undefined;
  logout: Pick<BackchannelLogoutRevoker, "revokeIdentitySessions">;
  durable: Pick<DurableSecurityEffects, "settle" | "reserve">;
  /** Told when noting a sign-in's use fails (it never fails the request). */
  onActivityFailed: (error: unknown) => void;
  now?: () => Date;
}) {
  const now = options.now ?? (() => new Date());
  const sessions = new DrizzleOidcRpSessionRepository(options.db);
  const continuity = new RedisIdTokenContinuityStore(options.redis, options.sealer);
  const activity = new SessionActivity(new DrizzleSessionActivityStore(options.db), now);
  return {
    activity,
    signOut: new BrowserSignOutService(
      new DrizzleBrowserSignOutStore(options.db),
      options.logout,
      (userId, sessionId) =>
        options.durable.settle(SIGN_OUT_PATH, {
          kind: "publish_session_revoked",
          userId,
          sessionId,
        }),
    ),
    refreshGuard: new SignInLivenessGuard({
      findLiveIdentitySession: (sid) => sessions.findLiveIdentitySession(sid, now()),
      peekContinuity: (hash) => continuity.peek(hash),
      recordActivity: (sessionId) => activity.record(sessionId),
      onActivityFailed: options.onActivityFailed,
    }),
    tokenBinding: new OAuthTokenSignInBinding(
      new DrizzleOAuthTokenSignInStore(options.db),
      async (sid, subjectId) =>
        (await sessions.findLiveIdentitySession(sid, now()))?.subjectId === subjectId,
    ),
    expirySweep: new SessionExpirySweep(
      new DrizzleSessionExpiryStore(options.db),
      {
        reserve: ({ userId, sessionIds }) =>
          options.durable.reserve(EXPIRY_PATH, [
            { kind: "revoke_identity_sessions", userId, sessionIds },
          ]),
      },
      now,
    ),
  };
}

export type BrowserSignIns = ReturnType<typeof createBrowserSignIns>;
