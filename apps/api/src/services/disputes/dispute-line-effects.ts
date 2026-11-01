import type { Database } from "@auction/db";
import { type DisputeFunds, disputeLineEffect } from "@auction/domain";
import type {
  DisputeAllocationRecord,
  DisputeCaseRecord,
  IDisputeCaseRepository,
} from "@auction/persistence/interfaces";
import { gbpPenceToMajorString } from "../../lib/decimal-money.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";

export type DisputeLineEffectsDeps = {
  cases: Pick<IDisputeCaseRepository, "setClawbackInTransaction">;
  payoutAdjustments: Pick<IPayoutAdjustmentService, "addPaymentLineToOpenPayoutOrCreateClawback">;
  events: IDomainEventSink;
};

export function disputeFundsOf(record: DisputeCaseRecord): DisputeFunds {
  return {
    withdrawn: record.fundsWithdrawnAt !== null,
    reinstated: record.fundsReinstatedAt !== null,
  };
}

const outcomeOf = (status: string) =>
  status === "won" ? "won" : status === "lost" ? "lost" : "closed";

/**
 * What an allocated case does to each invoice it falls on: the seller payout moves and the
 * payment events the dispute list, seller notices and lot guards read. Each payout move is
 * recorded on its line, so it happens once however often or late the webhooks arrive.
 */
export class DisputeLineEffects {
  constructor(private readonly deps: DisputeLineEffectsDeps) {}

  /** Brings every line's seller payout in line with the case's funds. */
  async reconcile(
    tx: Database,
    record: DisputeCaseRecord,
    lines: readonly DisputeAllocationRecord[],
    reversalNote: string,
  ): Promise<void> {
    const funds = disputeFundsOf(record);
    for (const line of lines) {
      const effect = disputeLineEffect(funds, line.clawback);
      if (!effect) continue;
      if (effect === "withdraw") {
        await this.movePayout(tx, line, -line.sellerSharePence, "withdrawn", {
          note: `Dispute funds withdrawn: ${record.stripeDisputeId}`,
          stripeDisputeId: record.stripeDisputeId,
        });
        await this.announce(tx, record, line, "payment.dispute_funds_withdrawn", {});
      } else {
        await this.movePayout(tx, line, line.sellerSharePence, "reversed", {
          note: `${reversalNote}: ${record.stripeDisputeId}`,
          stripeDisputeId: record.stripeDisputeId,
        });
      }
    }
  }

  async publishOpened(
    tx: Database,
    record: DisputeCaseRecord,
    lines: readonly DisputeAllocationRecord[],
  ): Promise<void> {
    for (const line of lines) {
      await this.announce(tx, record, line, "payment.dispute_opened", {
        reason: record.reason,
      });
    }
  }

  async publishClosed(
    tx: Database,
    record: DisputeCaseRecord,
    lines: readonly DisputeAllocationRecord[],
  ): Promise<void> {
    for (const line of lines) {
      await this.announce(tx, record, line, "payment.dispute_closed", {
        outcome: outcomeOf(record.status),
      });
    }
  }

  private async movePayout(
    tx: Database,
    line: DisputeAllocationRecord,
    pence: number,
    clawback: "withdrawn" | "reversed",
    ctx: { note: string; stripeDisputeId: string },
  ): Promise<void> {
    if (line.sellerSharePence > 0) {
      await this.deps.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: line.sellerLegalEntityId,
        paymentId: line.paymentId,
        amount: gbpPenceToMajorString(pence),
        kind: "dispute",
        sourceEventId: `dispute:${ctx.stripeDisputeId}:${line.paymentId}:${clawback}`,
        note: ctx.note,
        tx,
      });
    }
    await this.deps.cases.setClawbackInTransaction(tx, line.id, clawback);
  }

  private announce(
    tx: Database,
    record: DisputeCaseRecord,
    line: DisputeAllocationRecord,
    eventType: string,
    extra: Record<string, unknown>,
  ): Promise<void> {
    return this.deps.events.withTx(tx).publish({
      aggregateType: "payment",
      aggregateId: line.paymentId,
      eventType,
      payload: {
        stripeDisputeId: record.stripeDisputeId,
        stripeChargeId: record.stripeChargeId,
        amountCents: line.amountPence,
        currency: record.currency,
        sellerLegalEntityId: line.sellerLegalEntityId,
        ...extra,
      },
      actorUserId: null,
      actingLegalEntityId: line.sellerLegalEntityId,
    });
  }
}
