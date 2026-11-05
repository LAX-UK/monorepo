import type { Database } from "@auction/db";
import {
  UNAPPLIED_MONEY_CLOSED_BY_CAPTURE,
  UNAPPLIED_MONEY_EVENT,
  UNAPPLIED_MONEY_RESOLVED_EVENT,
  type UnappliedMoney,
  unappliedMoneyPayload,
} from "@auction/domain";
import type { IUnappliedMoneyReader, OpenUnappliedMoney } from "@auction/persistence/interfaces";
import type { IDomainEventSinkPort } from "./domain-event-sink-port.js";
import { type IMoneyPathMetrics, noMoneyPathMetrics } from "./money-path-metrics.js";

export interface IUnappliedMoneyRecorder {
  /**
   * Opens a finance task (with its alert) for money that could not be applied. Never refunds.
   * Reporting the same money again, from a webhook replay or a later cron run, does nothing.
   */
  record(tx: Database, money: UnappliedMoney, actingLegalEntityId: string | null): Promise<void>;
  /** A full refund of the charge closes its open tasks. */
  resolveRefundedCharge(tx: Database, chargeId: string): Promise<void>;
  /**
   * The money has now been applied to its invoice (the capture the task asked for happened), so
   * a "paid, not recorded" task for the same intent or charge closes.
   */
  resolveApplied(
    tx: Database,
    money: { paymentIntentId: string | null; chargeId: string | null },
  ): Promise<void>;
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
  resolveApplied: async () => {
    throw new Error("unapplied_money_recorder_not_configured");
  },
};

/** How a task was closed, carried on the "resolved" event. */
export type UnappliedMoneyResolution =
  | { via: "charge_refunded"; chargeId: string }
  | { via: "captured" }
  /** A newer report of a customer's Stripe balance replaced this one. */
  | { via: "superseded" }
  | { via: "staff"; actorUserId: string; note: string };

export class UnappliedMoneyRecorder implements IUnappliedMoneyRecorder {
  constructor(
    private readonly reader: IUnappliedMoneyReader,
    private readonly events: IDomainEventSinkPort,
    private readonly metrics: IMoneyPathMetrics = noMoneyPathMetrics,
  ) {}

  async record(
    tx: Database,
    money: UnappliedMoney,
    actingLegalEntityId: string | null,
  ): Promise<void> {
    const payload = unappliedMoneyPayload(money);
    await this.reader.lockKey(tx, payload.dedupeKey);
    if (await this.reader.exists(payload.dedupeKey, tx)) return;
    // Stripe reports a customer's whole balance each time: the newest report replaces the
    // earlier open ones, so the same money is never shown twice.
    if (money.reason === "customer_balance_unapplied" && money.stripeCustomerId) {
      const earlier = await this.reader.listOpen({
        reasons: ["customer_balance_unapplied"],
        stripeCustomerId: money.stripeCustomerId,
        limit: 50,
      });
      await this.resolve(tx, earlier, { via: "superseded" });
    }
    this.metrics.record(`unapplied_money_${money.reason}`);
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
    await this.resolve(tx, open, { via: "charge_refunded", chargeId });
  }

  async resolveApplied(
    tx: Database,
    money: { paymentIntentId: string | null; chargeId: string | null },
  ): Promise<void> {
    if (!money.paymentIntentId && !money.chargeId) return;
    const open = await this.reader.listOpen({
      paymentIntentId: money.paymentIntentId,
      chargeId: money.chargeId,
      reasons: UNAPPLIED_MONEY_CLOSED_BY_CAPTURE,
      limit: 10,
    });
    await this.resolve(tx, open, { via: "captured" });
  }

  /** Closes the given tasks, saying how. Each task closes once: the reader lists only open ones. */
  async resolve(
    tx: Database,
    open: readonly OpenUnappliedMoney[],
    resolution: UnappliedMoneyResolution,
  ): Promise<void> {
    for (const money of open) {
      await this.events.withTx(tx).publish({
        aggregateType: money.paymentId ? "payment" : "payment_group",
        aggregateId: money.paymentId ?? money.paymentGroupId ?? money.dedupeKey,
        eventType: UNAPPLIED_MONEY_RESOLVED_EVENT,
        payload: {
          dedupeKey: money.dedupeKey,
          via: resolution.via,
          ...(resolution.via === "charge_refunded" ? { stripeChargeId: resolution.chargeId } : {}),
          ...(resolution.via === "staff" ? { note: resolution.note } : {}),
        },
        actorUserId: resolution.via === "staff" ? resolution.actorUserId : null,
        actingLegalEntityId: null,
      });
    }
  }
}
