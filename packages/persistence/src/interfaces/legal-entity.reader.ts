import type { LegalEntity, LegalEntitySummary } from "@auction/types";
import type { ActiveMembership } from "./legal-entity.repository.js";

export interface ILegalEntityReader {
  findById(id: string): Promise<LegalEntity | null>;
  findByIds(ids: readonly string[]): Promise<LegalEntity[]>;
  setXeroContactId(legalEntityId: string, xeroContactId: string): Promise<void>;
  setStripeCustomerId(legalEntityId: string, stripeCustomerId: string): Promise<void>;
  findPrimaryAddressForXero(legalEntityId: string): Promise<{
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
  } | null>;
  findPreferredBillToLegalEntityAddress(legalEntityId: string): Promise<{
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string;
    addressType: string;
  } | null>;
}

export interface ILegalEntityMembershipReader {
  listActiveMembershipsForUser(userId: string): Promise<LegalEntitySummary[]>;
  findActiveMembership(userId: string, legalEntityId: string): Promise<ActiveMembership | null>;
  listImpersonationNoticeRecipientEmails(
    legalEntityId: string,
  ): Promise<{ email: string; userId: string }[]>;
  ensurePersonalEntity(userId: string): Promise<LegalEntitySummary>;
}
