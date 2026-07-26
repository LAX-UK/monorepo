export type OAuthMarketingProvider = "google" | "apple";

export interface IAuthOAuthAccountReader {
  hasLinkedProvider(userId: string, provider: OAuthMarketingProvider): Promise<boolean>;
}
