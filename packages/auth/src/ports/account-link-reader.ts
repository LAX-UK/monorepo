export type AccountLinkReader = {
  countAccountsForUser(userId: string): Promise<number>;
  isEmailVerified(userId: string): Promise<boolean | null>;
  findUserEmailProfile(
    userId: string,
  ): Promise<{ email: string; name: string; createdAt: Date } | null>;
};
