import { MEMBER_REMOVED_STOP_REASON, stopsOnRemoval } from "@auction/domain";
import type {
  DbTransaction,
  IMemberBidInstructionsRepository,
} from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  IRemovedMemberBidStopper,
  StoppedInstruction,
} from "../interfaces/organisation-membership-service.js";

/**
 * Stops the auto-bid ceilings and absentee bids a removed member set up for the organisation,
 * in the removal's transaction, with one audit entry per stopped instruction. The domain decides
 * which instructions can still bid; an instruction already stopped (a retried removal) is
 * skipped, so nothing is recorded twice.
 */
export class RemovedMemberBidStopper implements IRemovedMemberBidStopper {
  constructor(
    private readonly instructions: IMemberBidInstructionsRepository,
    private readonly events: IDomainEventSink,
  ) {}

  async stopFor(
    tx: DbTransaction,
    input: { legalEntityId: string; memberUserId: string; actorUserId: string },
  ): Promise<StoppedInstruction[]> {
    const candidates = await this.instructions.listForMember(
      tx,
      input.legalEntityId,
      input.memberUserId,
    );
    const stopped: StoppedInstruction[] = [];
    for (const instruction of candidates.filter(stopsOnRemoval)) {
      const changed = await this.instructions.stop(
        tx,
        input.legalEntityId,
        input.memberUserId,
        instruction,
        MEMBER_REMOVED_STOP_REASON,
      );
      if (!changed) continue;
      await this.events.withTx(tx).publish({
        aggregateType: "legal_entity",
        aggregateId: input.legalEntityId,
        eventType: "legal_entity.member_bid_stopped",
        payload: {
          bid_kind: instruction.kind,
          bid_ref: instruction.id,
          lot_id: instruction.lotId,
          lot_title: instruction.lotTitle,
          lot_number: instruction.lotNumber,
          max_amount: instruction.maxAmount,
          member_user_id: input.memberUserId,
          reason: MEMBER_REMOVED_STOP_REASON,
        },
        actorUserId: input.actorUserId,
        actingLegalEntityId: input.legalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });
      stopped.push({
        kind: instruction.kind,
        id: instruction.id,
        lotId: instruction.lotId,
        lotTitle: instruction.lotTitle,
        lotNumber: instruction.lotNumber,
        maxAmount: instruction.maxAmount,
      });
    }
    return stopped;
  }
}
