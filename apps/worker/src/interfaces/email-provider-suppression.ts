/** What asking the provider to stop blocking an address came to. */
export type ProviderReactivation = "reactivated" | "not_blocked" | "still_blocked";

/** The email provider's own block list, per message stream. */
export interface IEmailProviderSuppression {
  /** Throws when the provider could not be reached or refused, so the job retries. */
  reactivate(email: string, stream: string): Promise<ProviderReactivation>;
}

/** Where a person's current address is kept. */
export interface IEmailAddressLookup {
  findEmail(userId: string): Promise<string | null>;
}
