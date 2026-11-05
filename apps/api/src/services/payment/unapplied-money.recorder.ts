import type { Database } from "@auction/db";
import {
  UNAPPLIED_MONEY_EVENT,
  UNAPPLIED_MONEY_RESOLVED_EVENT,
  type UnappliedMoney,
  unappliedMoneyPayload,
} from "@auction/domain";
import type { IUnappliedMoneyReader } from "@auction/persistence/interfaces";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IDomainEventSink } from "../domain-event-sink.js";

export interface IUnappliedMoneyRecorder {
  /**
   * Opens a finance task (with its alert) for money that could not be applied. Never refunds.
   * Reporting the same money again, from a webhook replay or a later cron run, does nothing.
   */
  record(tx: Database, money: UnappliedMoney, actingLegalEntityId: string | null): Promise<void>;
  /** A full refund of the charge closes its open tasks. */
  resolveRefundedCharge(tx: Database, chargeId: string): Promise<void>;
}

/**
 * Used only where no recorder was wired (tests of unrelated handlers). Money must never be dropped
 * silently, so reporting any throws and the webhook is retried until a recorder is in place.
 */
export const NO_UNAPPLIED_MONEY_RECORDER: IUnappliedMoneyRecorder = {
  record: async () => {
    throw new Error("unapplied_money_recorder_not_configured");
  },
  resolveRefundedCharge: async () => {
    throw new Error("unapplied_money_recorder_not_configured");
  },
};

export class UnappliedMoneyRecorder implements IUnappliedMoneyRecorder {
  constructor(
    private readonly reader: IUnappliedMoneyReader,
    private readonly events: IDomainEventSink,
  ) {}

  async record(
    tx: Database,
    money: UnappliedMoney,
    actingLegalEntityId: string | null,
  ): Promise<void> {
    const payload = unappliedMoneyPayload(money);
    if (await this.reader.exists(payload.dedupeKey)) return;
    recordMoneyPathEvent(`unapplied_money_${money.reason}`);
    console.error(JSON.stringify({ msg: "unapplied_money_received", ...payload }));
    await this.events.withTx(tx).publish({
      aggregateType: money.paymentId ? "payment" : "payment_group",
      aggregateId: money.paymentId ?? money.paymentGroupId ?? payload.dedupeKey,
      eventType: UNAPPLIED_MONEY_EVENT,
      payload,
      actorUserId: null,
      actingLegalEntityId,
    });
  }

  async resolveRefundedCharge(tx: Database, chargeId: string): Promise<void> {
    const open = await this.reader.listOpenByChargeId(chargeId);
    for (const money of open) {
      await this.events.withTx(tx).publish({
        aggregateType: money.paymentId ? "payment" : "payment_group",
        aggregateId: money.paymentId ?? money.paymentGroupId ?? money.dedupeKey,
        eventType: UNAPPLIED_MONEY_RESOLVED_EVENT,
        payload: { dedupeKey: money.dedupeKey, stripeChargeId: chargeId, via: "charge_refunded" },
        actorUserId: null,
        actingLegalEntityId: null,
      });
    }
  }
}
