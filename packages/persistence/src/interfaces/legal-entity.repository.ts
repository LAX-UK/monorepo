import type { LegalEntity, LegalEntitySummary } from "@auction/types";
import type { DbTransaction } from "./artist-delete.repository.js";

/** Active membership row used to validate `X-Legal-Entity-Id` headers. */
export type ActiveMembership = {
  legalEntityId: string;
  userId: string;
  role: LegalEntitySummary["role"];
  isPrimaryAdmin: boolean;
  /** synthetic context when platform admin impersonates a non-member entity. */
  isImpersonation?: boolean;
  impersonationSessionId?: string;
  impersonationExpiresAt?: Date;
};

export interface ILegalEntityRepository {
  /** Find a single legal entity by id (full row). */
  findById(id: string): Promise<LegalEntity | null>;

  /** Batch load legal entities by id (deduped). */
  findByIds(ids: readonly string[]): Promise<LegalEntity[]>;

  /** List the active (`removed_at IS NULL` and `accepted_at IS NOT NULL`)
   * memberships for a user, joined with the legal entity for the
   * switcher / banner.
   */
  listActiveMembershipsForUser(userId: string): Promise<LegalEntitySummary[]>;

  /** Single active membership lookup; used by the require-context middleware. */
  findActiveMembership(userId: string, legalEntityId: string): Promise<ActiveMembership | null>;

  /** distinct member emails for impersonation notice (owner, admin, or
   * primary admin flag).
   */
  listImpersonationNoticeRecipientEmails(
    legalEntityId: string,
  ): Promise<{ email: string; userId: string }[]>;

  /** persist canonical Xero Contact id after find/create. */
  setXeroContactId(legalEntityId: string, xeroContactId: string): Promise<void>;

  setStripeCustomerId(legalEntityId: string, stripeCustomerId: string): Promise<void>;

  /** primary-ish address row for Xero contact sync (default first, else any).
   */
  findPrimaryAddressForXero(legalEntityId: string): Promise<{
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
  } | null>;

  /** preferred `legal_entity_address` for bill-to (billing → both →
   * registered_office), then `is_default` within the same type.
   */
  findPreferredBillToLegalEntityAddress(legalEntityId: string): Promise<{
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
    addressType: string;
  } | null>;

  /** Find or create the personal (`individual`/`private_collector`) entity for
   * the user. Idempotent — used by acting-context default selection.
   */
  ensurePersonalEntity(userId: string): Promise<LegalEntitySummary>;

  /** After KYC approval, advance sole-trader individuals stuck in `lead`. Idempotent. */
  advanceIndividualLeadsToConnectPendingAfterKyc(
    userId: string,
    tx: DbTransaction,
  ): Promise<{ id: string }[]>;
}
