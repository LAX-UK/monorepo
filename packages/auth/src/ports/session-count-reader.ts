export type SessionCountReader = {
  countSessionsForUser(userId: string): Promise<number>;
};
