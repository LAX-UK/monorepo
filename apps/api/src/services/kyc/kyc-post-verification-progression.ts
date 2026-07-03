import type { ITransactionRunner } from "@auction/persistence";
import type { ILegalEntityRepository } from "@auction/persistence";
import type { DomainEventPublisher } from "../domain-event.publisher.js";

export type KycPostVerificationProgressionDeps = {
  transactionRunner: ITransactionRunner;
  legalEntityRepository: ILegalEntityRepository;
  domainEventPublisher: DomainEventPublisher | undefined;
};

/**
 * After KYC approval, advance sole-trader individuals stuck in `lead`. Idempotent.
 * Returns the legal entity ids advanced to `connect_pending` so callers can provision
 * Stripe Connect accounts outside this transaction (best-effort).
 */
export async function progressIndividualsAfterKycApproval(
  deps: KycPostVerificationProgressionDeps,
  userId: string,
): Promise<string[]> {
  return deps.transactionRunner.runInTransaction(async (tx) => {
    const advancedIds = (
      await deps.legalEntityRepository.advanceIndividualLeadsToConnectPendingAfterKyc(userId, tx)
    ).map((row) => row.id);

    if (!deps.domainEventPublisher || advancedIds.length === 0) {
      return advancedIds;
    }

    await deps.domainEventPublisher.publish(tx, {
      aggregateType: "user",
      aggregateId: userId,
      eventType: "kyc.verified",
      payload: {
        legalEntityIdsAdvancedToConnectPending: advancedIds,
      },
      actorUserId: null,
      actingLegalEntityId: null,
    });

    for (const legalEntityId of advancedIds) {
      await deps.domainEventPublisher.publish(tx, {
        aggregateType: "legal_entity",
        aggregateId: legalEntityId,
        eventType: "legal_entity.lifecycle_progressed",
        payload: {
          from_status: "lead",
          to_status: "connect_pending",
          reason: "kyc_approved",
        },
        actorUserId: null,
        actingLegalEntityId: legalEntityId,
      });
    }

    return advancedIds;
  });
}
