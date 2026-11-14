import type { Database } from "@auction/db";
import {
  UNAPPLIED_MONEY_CLOSED_BY_CAPTURE,
  UNAPPLIED_MONEY_EVENT,
  UNAPPLIED_MONEY_RESOLVED_EVENT,
  type UnappliedMoney,
  unappliedMoneyAggregate,
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

/** Reasons that report the whole of an intent's money, replacing a part-transfer task for it. */
const SUPERSEDES_PART_TRANSFER: readonly UnappliedMoney["reason"][] = [
  "invoice_already_paid",
  "customer_balance_unapplied",
];

/** The unique index on the received event's dedupe key (migration 0383). */
const DEDUPE_KEY_INDEX = "domain_events_unapplied_money_dedupe_key_uid";

type PgError = { code?: unknown; constraint?: unknown; message?: unknown; cause?: unknown };

/**
 * True for Postgres's unique violation on the dedupe-key index, as the driver raises it or
 * wrapped as a query error's `cause`. Any other error is not "already recorded".
 */
export function isUnappliedMoneyDedupeViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && typeof e === "object" && depth < 3; depth += 1) {
    const pg = e as PgError;
    if (pg.code === "23505") {
      const constraint = typeof pg.constraint === "string" ? pg.constraint : "";
      const message = typeof pg.message === "string" ? pg.message : "";
      return constraint === DEDUPE_KEY_INDEX || message.includes(DEDUPE_KEY_INDEX);
    }
    e = pg.cause;
  }
  return false;
}

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
    // Stripe reports a customer's balance in a currency each time: the newest report replaces
    // the earlier open ones of that currency, so the same money is never shown twice. The
    // customer is locked first, so two reports at once take turns and the second sees the first.
    if (money.reason === "customer_balance_unapplied" && money.stripeCustomerId) {
      await this.reader.lockKey(tx, `customer:${money.stripeCustomerId}`);
      const earlier = await this.reader.listOpen(
        {
          reasons: ["customer_balance_unapplied"],
          stripeCustomerId: money.stripeCustomerId,
          currency: payload.currency,
          limit: 50,
        },
        tx,
      );
      await this.resolve(tx, earlier, { via: "superseded" });
    }
    // Once the same intent is reported as paid twice, or as a balance, it is no longer a part
    // payment: that earlier task is replaced by this one.
    if (money.stripePaymentIntentId && SUPERSEDES_PART_TRANSFER.includes(money.reason)) {
      const partial = await this.reader.listOpen(
        {
          reasons: ["transfer_partially_funded_after_paid"],
          paymentIntentId: money.stripePaymentIntentId,
          limit: 10,
        },
        tx,
      );
      await this.resolve(tx, partial, { via: "superseded" });
    }
    this.metrics.record(`unapplied_money_${money.reason}`);
    // The reference a payer quoted is left out of the log: it is typed by a person.
    const { transferReference: _quoted, ...loggable } = payload;
    console.error(JSON.stringify({ msg: "unapplied_money_received", ...loggable }));
    // The database refuses a second event for the same key (index 0383). A writer outside this
    // lock that got there first is not an error: the money is already recorded. The insert runs
    // in a savepoint so that refusal leaves the caller's transaction (and its webhook claim)
    // usable, and the caller carries on as if this report had found the first one.
    try {
      await tx.transaction(async (savepoint) => {
        await this.events.withTx(savepoint).publish({
          ...unappliedMoneyAggregate(money, payload.dedupeKey),
          eventType: UNAPPLIED_MONEY_EVENT,
          payload,
          actorUserId: null,
          actingLegalEntityId,
        });
      });
    } catch (err) {
      if (!isUnappliedMoneyDedupeViolation(err)) throw err;
      this.metrics.record("unapplied_money_already_recorded");
      console.info(
        JSON.stringify({ msg: "unapplied_money_already_recorded", dedupeKey: payload.dedupeKey }),
      );
    }
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
        ...unappliedMoneyAggregate(money, money.dedupeKey),
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
