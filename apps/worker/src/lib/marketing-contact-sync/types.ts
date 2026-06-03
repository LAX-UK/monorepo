/**
 * Provider-agnostic seam for syncing a registered user into an external marketing
 * ESP (Brevo today; Mailchimp/Zoho can be added as further adapters). Callers (the
 * worker job + projector) depend only on this interface — never on a provider SDK.
 */

export type MarketingContact = {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  /** ISO 3166-1 alpha-2 region (from `user.mobile_country`). */
  country?: string | null;
  kycStatus: string;
  emailVerified: boolean;
  signupSource?: string | null;
  createdAt: Date;
};

export type SyncAction = "upsert" | "archive" | "skipped";

export type SyncResult =
  | { ok: true; action: SyncAction; providerContactId?: string | undefined }
  | { ok: false; retryable: boolean; code?: number | undefined; message: string };

export interface IMarketingContactSync {
  readonly provider: string;
  /** True when the adapter has the credentials it needs to make calls. */
  enabled(): boolean;
  /** Create or update the contact in the ESP. Idempotent (keyed by email). */
  upsertContact(contact: MarketingContact): Promise<SyncResult>;
  /** Remove the contact from the ESP (GDPR erasure / deletion-requested). */
  archiveContact(email: string): Promise<SyncResult>;
}
