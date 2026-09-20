export type SessionTokens = {
  idToken: string;
  refreshToken: string | null;
  refreshExpiresAt: Date | null;
};

export type SessionTokenReadOptions = {
  /** Legacy rollout: cookie-held ID token when the row has no stored tokens yet. */
  legacyIdToken?: string | null;
};

export interface SessionTokenStore {
  read(sessionId: string, options?: SessionTokenReadOptions): Promise<SessionTokens | null>;
  save(sessionId: string, tokens: SessionTokens): Promise<void>;
  clear(sessionId: string): Promise<void>;
  hasStoredRefreshToken(sessionId: string): Promise<boolean>;
  /** Serializes rotation for one session; `current` is read inside the lock. */
  withLock<T>(
    sessionId: string,
    run: (ctx: {
      current: SessionTokens | null;
      save: (next: SessionTokens) => Promise<void>;
    }) => Promise<T>,
  ): Promise<T>;
}
