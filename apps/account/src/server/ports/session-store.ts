import type { LaxResourceId } from "@auction/identity-contracts";

/** An audience-bound access token minted for one product API, and when it stops being valid. */
export type CachedResourceToken = { token: string; expiresAtMs: number };

export type StaffSessionRecord = {
  subject: string;
  sid: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtMs: number;
  authTime: number;
  acr: string;
  /**
   * Tokens exchanged for product APIs, kept for their own lifetime so a page that reads two
   * products does not hit the token endpoint on every request. Absent until first used. Keyed by
   * the resource id for the portfolio scope, and by "<resource> <scope>" for any other scope.
   */
  resourceTokens?: Partial<
    Record<LaxResourceId | `${LaxResourceId} ${string}`, CachedResourceToken>
  >;
};

export type SessionStore = {
  get(sessionId: string): Promise<StaffSessionRecord | null>;
  save(sessionId: string, record: StaffSessionRecord, ttlSeconds: number): Promise<void>;
  delete(sessionId: string): Promise<void>;
  invalidateBySidOrSubject(input: { sid?: string; sub?: string }): Promise<void>;
  /** Returns false when the logout token jti was already consumed. */
  claimBackchannelLogoutJti(jti: string, ttlSeconds: number): Promise<boolean>;
  /** Frees a claimed jti so the issuer can retry after a failed invalidation. */
  releaseBackchannelLogoutJti(jti: string): Promise<void>;
  /**
   * Takes the pending sign-in identified by its `state` for one callback. False when another
   * callback already took it, or a sign-out ended it: the code must not be exchanged.
   */
  claimPendingLogin(state: string, ttlSeconds: number): Promise<boolean>;
  /** True when a sign-out ended the pending sign-in (as opposed to a callback having used it). */
  isPendingLoginRevoked(state: string): Promise<boolean>;
  /**
   * Records the session a claimed sign-in created, so a sign-out that comes later still ends it.
   * False when a sign-out ended the sign-in meanwhile: the caller deletes that session.
   */
  settlePendingLogin(state: string, sessionId: string): Promise<boolean>;
  /**
   * Ends a pending sign-in on sign-out: a callback that has not claimed it yet is refused, and a
   * session it already created is deleted.
   */
  revokePendingLogin(state: string, ttlSeconds: number): Promise<void>;
  withRefreshLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T>;
  /** Readiness probe for the backing store. */
  isReachable(): Promise<boolean>;
};
