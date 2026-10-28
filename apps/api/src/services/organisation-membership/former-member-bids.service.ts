import { entityActorCan } from "@auction/domain";
import type {
  FormerMemberBidRef,
  FormerMemberOpenBid,
  IFormerMemberBidsRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import { type Result, ok } from "neverthrow";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  IFormerMemberBidsService,
  IProxyCancelledRealtime,
  OrganisationMemberActor,
  OrganisationMembershipError,
} from "../interfaces/organisation-membership-service.js";
import { membershipFailure } from "./organisation-membership-errors.js";

/** Why the bid ended, as recorded on it and told to the bidder. */
export const CANCELLED_BY_ORGANISATION = "cancelled_by_organisation";

export type FormerMemberBidsServiceDeps = {
  bids: IFormerMemberBidsRepository;
  transactions: ITransactionRunner;
  events: IDomainEventSink;
  realtime: IProxyCancelledRealtime;
};

/**
 * Removing a member leaves the bids they placed for the organisation standing. Owners and admins
 * see those that can still act (auto-bid maximums on live lots, absentee bids not yet run) and
 * may cancel them; each cancellation is recorded and the bidder is told.
 */
export class FormerMemberBidsService implements IFormerMemberBidsService {
  constructor(private readonly deps: FormerMemberBidsServiceDeps) {}

  async list(
    actor: OrganisationMemberActor,
  ): Promise<Result<FormerMemberOpenBid[], OrganisationMembershipError>> {
    // Reading follows the same rule as cancelling, without the write restriction on support.
    if (!entityActorCan({ role: actor.role }, "entity.member_bids.cancel")) {
      return membershipFailure("forbidden");
    }
    return ok(await this.deps.bids.listForEntity(actor.legalEntityId));
  }

  async cancel(
    actor: OrganisationMemberActor,
    ref: FormerMemberBidRef,
  ): Promise<Result<FormerMemberOpenBid, OrganisationMembershipError>> {
    if (!entityActorCan(actor, "entity.member_bids.cancel")) return membershipFailure("forbidden");

    const cancelled = await this.deps.transactions.runInTransaction(async (tx) => {
      const row = await this.deps.bids.cancel(
        tx,
        actor.legalEntityId,
        ref,
        CANCELLED_BY_ORGANISATION,
      );
      if (!row) return null;
      await this.deps.events.withTx(tx).publish({
        aggregateType: "legal_entity",
        aggregateId: actor.legalEntityId,
        eventType: "legal_entity.former_member_bid_cancelled",
        payload: {
          bid_kind: row.kind,
          bid_ref: row.id,
          lot_id: row.lotId,
          member_user_id: row.memberUserId,
          max_amount: row.maxAmount,
          cancelled_by_user_id: actor.userId,
        },
        actorUserId: actor.userId,
        actingLegalEntityId: actor.legalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });
      return row;
    });
    if (!cancelled) return membershipFailure("not_found");

    if (cancelled.kind === "auto_bid") {
      // Open lot pages drop the bidder's maximum straight away; failure only delays that.
      await this.deps.realtime
        .notifyProxyCancelled(cancelled.lotId, cancelled.memberUserId, CANCELLED_BY_ORGANISATION)
        .catch(() => undefined);
    }
    return ok(cancelled);
  }
}
