import { type RefreshSignInGuard, hashRefreshToken } from "./refresh-token-family.ports.js";
import type { IdTokenContinuityRecord } from "./refreshed-id-token.service.js";

export type RefreshSignInGuardDeps = {
  /** The record behind `sid`, or the one that took it over, only while it is still signed in. */
  findLiveIdentitySession(sid: string): Promise<{ id: string; subjectId: string } | null>;
  /** What was remembered when the token was issued, without using it up. */
  peekContinuity(refreshTokenHash: string): Promise<Pick<IdTokenContinuityRecord, "sid"> | null>;
  /** Notes that the record was used; best effort, never decides the outcome. */
  recordActivity(sessionId: string): Promise<void>;
  /** Told when noting the use failed. */
  onActivityFailed(error: unknown): void;
};

/**
 * Refuses refresh once the sign-in behind a token is over (signed out, expired, idle too long or
 * signed in too long), for every client. The sign-in is the
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
    if (session === null || session.subjectId !== input.userId) return false;
    // A refresh is use of the sign-in (it keeps the record from going idle). Failing to note it
    // must not turn a live sign-in into a refused refresh; the next use notes it.
    await this.deps
      .recordActivity(session.id)
      .catch((error: unknown) => this.deps.onActivityFailed(error));
    return true;
  }
}
