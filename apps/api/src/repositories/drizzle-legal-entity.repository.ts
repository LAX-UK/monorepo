import type { Database } from "@auction/db";
import type { LegalEntity, LegalEntitySummary } from "@auction/types";
import type {
  ActiveMembership,
  ILegalEntityRepository,
} from "../services/interfaces/legal-entity-repository.js";
import { DrizzleLegalEntityMembershipReader } from "./drizzle-legal-entity-membership.reader.js";
import { DrizzleLegalEntityReader } from "./drizzle-legal-entity.reader.js";
import type {
  ILegalEntityMembershipReader,
  ILegalEntityReader,
} from "./interfaces/legal-entity.reader.js";

/** Composite facade preserving the pre-split repository surface for callers. */
export class DrizzleLegalEntityRepository implements ILegalEntityRepository {
  constructor(
    private readonly entities: DrizzleLegalEntityReader,
    private readonly membership: DrizzleLegalEntityMembershipReader,
  ) {}

  findById(id: string): Promise<LegalEntity | null> {
    return this.entities.findById(id);
  }

  findByIds(ids: readonly string[]): Promise<LegalEntity[]> {
    return this.entities.findByIds(ids);
  }

  listActiveMembershipsForUser(userId: string): Promise<LegalEntitySummary[]> {
    return this.membership.listActiveMembershipsForUser(userId);
  }

  setXeroContactId(legalEntityId: string, xeroContactId: string): Promise<void> {
    return this.entities.setXeroContactId(legalEntityId, xeroContactId);
  }

  setStripeCustomerId(legalEntityId: string, stripeCustomerId: string): Promise<void> {
    return this.entities.setStripeCustomerId(legalEntityId, stripeCustomerId);
  }

  findPreferredBillToLegalEntityAddress(
    legalEntityId: string,
  ): ReturnType<ILegalEntityReader["findPreferredBillToLegalEntityAddress"]> {
    return this.entities.findPreferredBillToLegalEntityAddress(legalEntityId);
  }

  findPrimaryAddressForXero(
    legalEntityId: string,
  ): ReturnType<ILegalEntityReader["findPrimaryAddressForXero"]> {
    return this.entities.findPrimaryAddressForXero(legalEntityId);
  }

  findActiveMembership(userId: string, legalEntityId: string): Promise<ActiveMembership | null> {
    return this.membership.findActiveMembership(userId, legalEntityId);
  }

  listImpersonationNoticeRecipientEmails(
    legalEntityId: string,
  ): ReturnType<ILegalEntityMembershipReader["listImpersonationNoticeRecipientEmails"]> {
    return this.membership.listImpersonationNoticeRecipientEmails(legalEntityId);
  }

  ensurePersonalEntity(userId: string): Promise<LegalEntitySummary> {
    return this.membership.ensurePersonalEntity(userId);
  }
}

export function createDrizzleLegalEntityRepository(db: Database) {
  const entities = new DrizzleLegalEntityReader(db);
  const membership = new DrizzleLegalEntityMembershipReader(db);
  return new DrizzleLegalEntityRepository(entities, membership);
}
