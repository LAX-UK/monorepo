import { type RefreshSignInGuard, hashRefreshToken } from "./refresh-token-family.ports.js";
import type { IdTokenContinuityRecord } from "./refreshed-id-token.service.js";

export type RefreshSignInGuardDeps = {
  /** The record behind `sid`, or the one that took it over, only while it is still signed in. */
  findLiveIdentitySession(sid: string): Promise<{ subjectId: string } | null>;
  /** What was remembered when the token was issued, without using it up. */
  peekContinuity(refreshTokenHash: string): Promise<Pick<IdTokenContinuityRecord, "sid"> | null>;
};

/**
 * Refuses refresh once the sign-in behind a token is over, for every client. The sign-in is the
 * one recorded on the token. A token issued before that was recorded is bound through the
 * continuity record kept for it; one with neither has no sign-in to check, and is bounded by its
 * own lifetime only.
 */
export class SignInLivenessGuard implements RefreshSignInGuard {
  constructor(private readonly deps: RefreshSignInGuardDeps) {}

  async isLive(input: {
    userId: string | null;
    sid: string | null;
    refreshToken: string;
  }): Promise<boolean> {
    const sid =
      input.sid ??
      (await this.deps.peekContinuity(hashRefreshToken(input.refreshToken)))?.sid ??
      null;
    if (!sid) return true;
    const session = await this.deps.findLiveIdentitySession(sid);
    return session !== null && session.subjectId === input.userId;
  }
}
