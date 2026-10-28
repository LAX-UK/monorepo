import { roleBidsThroughAuthorisation } from "@auction/domain";
import type {
  BuyerAgentAuthorisationRecord,
  IBuyerAgentAuthorisationDirectory,
  ISaleRegistrationRepository,
  ISaleRepository,
} from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole, MyBuyerAgentAuthorisation } from "@auction/types";

/** Registrations that count: waiting for LAX's decision, or approved. */
const LIVE_REGISTRATION = new Set(["pending", "approved"]);

export type MyBuyerAgentAuthorisationsDeps = {
  directory: Pick<IBuyerAgentAuthorisationDirectory, "listForLegalEntity">;
  sales: Pick<ISaleRepository, "findById">;
  registrations: Pick<ISaleRegistrationRepository, "findBySaleUserEntity">;
  now?: () => Date;
};

export interface IMyBuyerAgentAuthorisationsService {
  list(member: {
    userId: string;
    legalEntityId: string;
    role: LegalEntityMemberRole;
  }): Promise<MyBuyerAgentAuthorisation[]>;
}

function inForce(record: BuyerAgentAuthorisationRecord, now: Date): boolean {
  return (
    record.status === "active" &&
    record.validFrom <= now &&
    (record.validUntil === null || record.validUntil > now)
  );
}

/**
 * A buyer agent's own authorisations for the organisation, so their Home can say which sales
 * to register in and what their limit is. Other members get an empty list.
 */
export class MyBuyerAgentAuthorisationsService implements IMyBuyerAgentAuthorisationsService {
  private readonly now: () => Date;

  constructor(private readonly deps: MyBuyerAgentAuthorisationsDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async list(member: {
    userId: string;
    legalEntityId: string;
    role: LegalEntityMemberRole;
  }): Promise<MyBuyerAgentAuthorisation[]> {
    if (!roleBidsThroughAuthorisation(member.role)) return [];
    const now = this.now();
    const records = (await this.deps.directory.listForLegalEntity(member.legalEntityId)).filter(
      (record) => record.userId === member.userId && inForce(record, now),
    );
    const rows = await Promise.all(records.map((record) => this.toRow(record, member, now)));
    return rows.filter((row): row is MyBuyerAgentAuthorisation => row !== null);
  }

  private async toRow(
    record: BuyerAgentAuthorisationRecord,
    member: { userId: string; legalEntityId: string },
    now: Date,
  ): Promise<MyBuyerAgentAuthorisation | null> {
    const base = {
      bidLimit: record.bidLimit,
      validUntil: record.validUntil?.toISOString() ?? null,
    };
    if (!record.saleId) return { ...base, sale: null };
    const [sale, registration] = await Promise.all([
      this.deps.sales.findById(record.saleId),
      this.deps.registrations.findBySaleUserEntity(
        record.saleId,
        member.userId,
        member.legalEntityId,
      ),
    ]);
    // A sale that has finished has nothing left to register for.
    if (!sale || sale.endTime <= now) return null;
    return {
      ...base,
      sale: {
        id: sale.id,
        title: sale.title,
        startTime: sale.startTime.toISOString(),
        registered: registration !== null && LIVE_REGISTRATION.has(registration.status),
      },
    };
  }
}
