export type OAuthAttributionProvider = "apple" | "google";

export interface IOAuthAttributionStore {
  markNewUser(userId: string): Promise<void>;
  completeNewUserAccount(userId: string, providerId: string): Promise<void>;
  resolveOutcome(
    userId: string,
    provider: OAuthAttributionProvider,
  ): Promise<"ignored" | "login" | "signup">;
}
