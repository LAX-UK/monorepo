import {
  AUTHORISATION_REVOCATION_REASON,
  type AuthorisationRevocationCause,
} from "@auction/domain";
import type {
  DbTransaction,
  IMemberBuyerAgentAuthorisationRevoker,
} from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IMemberAuthorisationRevoker } from "../interfaces/organisation-membership-service.js";

/**
 * Ends the buyer-agent authorisations of a member who left or changed role, in the change's
 * transaction, so the old limits can never come back if the person is made a buyer agent again.
 */
export class MemberAuthorisationRevoker implements IMemberAuthorisationRevoker {
  constructor(
    private readonly authorisations: IMemberBuyerAgentAuthorisationRevoker,
    private readonly events: IDomainEventSink,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async revokeFor(
    tx: DbTransaction,
    input: {
      legalEntityId: string;
      memberUserId: string;
      actorUserId: string;
      cause: AuthorisationRevocationCause;
    },
  ): Promise<void> {
    const revoked = await this.authorisations.revokeAllForMember(tx, {
      legalEntityId: input.legalEntityId,
      userId: input.memberUserId,
      reason: AUTHORISATION_REVOCATION_REASON[input.cause],
      revokedAt: this.now(),
    });
    if (revoked.length === 0) return;
    await this.events.withTx(tx).publish({
      aggregateType: "legal_entity",
      aggregateId: input.legalEntityId,
      eventType: "legal_entity.member_authorisations_revoked",
      payload: {
        member_user_id: input.memberUserId,
        authorisations: revoked.map((r) => ({ authorisation_id: r.id, sale_id: r.saleId })),
        cause: input.cause,
      },
      actorUserId: input.actorUserId,
      actingLegalEntityId: input.legalEntityId,
      schemaVersion: 1,
      producer: "apps/api",
    });
  }
}
