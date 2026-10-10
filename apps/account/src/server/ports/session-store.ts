export type StaffSessionRecord = {
  subject: string;
  sid: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtMs: number;
  authTime: number;
  acr: string;
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
  withRefreshLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T>;
  /** Readiness probe for the backing store. */
  isReachable(): Promise<boolean>;
};
