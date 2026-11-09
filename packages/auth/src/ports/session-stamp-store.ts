export type SessionStampStore = {
  stampPasswordAuth(sessionToken: string, at: Date): Promise<void>;
  stampMfaCompleted(sessionToken: string, at: Date): Promise<void>;
  stampSocialAuth(sessionToken: string, at: Date): Promise<void>;
  /** A verified passkey sign-in: the session is both who they are and a second step. */
  stampPasskeyAuth(sessionToken: string, at: Date): Promise<void>;
};
