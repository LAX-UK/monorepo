export type SessionStampStore = {
  stampPasswordAuth(sessionToken: string, at: Date): Promise<void>;
  stampMfaCompleted(sessionToken: string, at: Date): Promise<void>;
};
