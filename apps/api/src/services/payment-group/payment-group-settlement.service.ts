import type { Database } from "@auction/db";
import {
  type PaymentGroupStatus,
  decidePaymentGroupSettlement,
  paymentGroupIsLive,
} from "@auction/domain";
import type {
  IPaymentGroupRepository,
  IPaymentLifecycleRepository,
  ITransactionRunner,
  PaymentGroupMember,
  PaymentGroupRecord,
} from "@auction/persistence/interfaces";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IPaymentCaptureInTransaction } from "../interfaces/payment-capture.js";
import type { PaymentWebhookResult } from "../stripe-webhook/payment-webhook-types.js";

/** Records a provider event as handled inside `tx`; `false` when it was handled before. */
export interface IProviderEventClaim {
  claim(tx: Database, eventId: string): Promise<boolean>;
}

/** The one receipt for a group's payment, sent once it is paid. */
export interface IPaymentGroupReceipt {
  send(group: PaymentGroupRecord, members: readonly PaymentGroupMember[]): Promise<void>;
}

/** Why a group was let go before it was paid. */
export type PaymentGroupReleaseReason =
  | "checkout_cancelled"
  | "checkout_expired"
  | "bank_transfer_failed"
  | "checkout_unavailable"
  | "accounting_unavailable"
  | "invoice_paid_separately";

export type PaymentGroupSettlementDeps = {
  transactionRunner: ITransactionRunner;
  groups: IPaymentGroupRepository;
  payments: Pick<IPaymentLifecycleRepository, "applyAuthorizedInTransaction">;
  capture: IPaymentCaptureInTransaction;
  events: IDomainEventSink;
  claims: IProviderEventClaim;
  receipt: IPaymentGroupReceipt;
};

const LIVE: PaymentGroupStatus[] = ["open", "processing"];
const DUPLICATE: PaymentWebhookResult = {
  processed: false,
  action: "skipped",
  reason: "duplicate_event",
};
const UNKNOWN_GROUP: PaymentWebhookResult = {
  processed: false,
  action: "skipped",
  reason: "payment_group_not_found",
};

/**
 * Moves a "Pay several" group through its life from the provider's events: the money arriving
 * settles every invoice at once, a bank transfer under way holds them, and a checkout that ends
 * unpaid hands them back. Each step runs in one transaction under one claimed event, so a repeated
 * event changes nothing.
 */
export class PaymentGroupSettlementService {
  constructor(private readonly deps: PaymentGroupSettlementDeps) {}

  /**
   * The group's money arrived: every invoice is marked paid in one transaction, or (on any
   * mismatch) none is and the finance team is alerted. Receipts and follow-ups run after commit.
   */
  async settle(input: {
    eventId: string;
    groupId: string;
    paymentIntentId: string;
    chargeId: string | null;
    amountPence: number;
    currency: string;
  }): Promise<PaymentWebhookResult> {
    const afterCommit: (() => Promise<void>)[] = [];
    let paid: { group: PaymentGroupRecord; members: PaymentGroupMember[] } | null = null;

    const result = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (!(await this.deps.claims.claim(tx, input.eventId))) return DUPLICATE;
      const locked = await this.deps.groups.lockInTransaction(tx, input.groupId);
      if (!locked) return UNKNOWN_GROUP;
      const { group, members } = locked;

      const decision = decidePaymentGroupSettlement({
        group: {
          status: group.status,
          totalPence: gbpAmountToPence(group.totalAmount),
          currency: group.currency,
        },
        members: members.map((m) => ({
          paymentId: m.paymentId,
          amountPence: gbpAmountToPence(m.amount),
          status: m.status,
        })),
        received: { amountPence: input.amountPence, currency: input.currency },
      });
      if (!decision.apply) {
        if (decision.alert) {
          await this.alertRefused(tx, group, decision.reason, input);
        }
        return { processed: true, action: "skipped", reason: decision.reason } as const;
      }

      for (const member of members) {
        const captured = await this.deps.capture.captureInTransaction({
          tx,
          paymentId: member.paymentId,
          via: "stripe_checkout_webhook",
          stripeChargeId: input.chargeId,
          stripePaymentIntentId: input.paymentIntentId,
          buyerReceipt: "none",
        });
        // Checked under the group's lock just above, so this only fails on a broken invariant;
        // throwing rolls every invoice back, never leaving a group half paid.
        if (!captured.captured) {
          throw new Error(`payment_group_member_not_captured:${member.paymentId}`);
        }
        afterCommit.push(captured.afterCommit);
      }
      await this.deps.groups.transitionInTransaction(tx, group.id, LIVE, "paid", {
        stripeChargeId: input.chargeId,
        stripePaymentIntentId: input.paymentIntentId,
      });
      await this.deps.events.withTx(tx).publish({
        aggregateType: "payment_group",
        aggregateId: group.id,
        eventType: "payment_group.paid",
        payload: {
          paymentGroupId: group.id,
          buyerLegalEntityId: group.buyerLegalEntityId,
          total: group.totalAmount,
          currency: group.currency,
          stripePaymentIntentId: input.paymentIntentId,
          stripeChargeId: input.chargeId,
          members: members.map((m) => ({
            paymentId: m.paymentId,
            lotId: m.lotId,
            amount: m.amount,
          })),
        },
        actorUserId: null,
        actingLegalEntityId: group.buyerLegalEntityId,
      });
      paid = { group, members };
      return { processed: true, action: "payment_intent_succeeded" } as const;
    });

    for (const run of afterCommit) await run();
    const settled = paid as { group: PaymentGroupRecord; members: PaymentGroupMember[] } | null;
    if (settled) {
      await this.deps.receipt.send(settled.group, settled.members);
      recordMoneyPathEvent("payment_group_paid");
    }
    return result;
  }

  /** A bank transfer was started for the group: its invoices are held while the money travels. */
  async markProcessing(input: { eventId: string; groupId: string }): Promise<PaymentWebhookResult> {
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (!(await this.deps.claims.claim(tx, input.eventId))) return DUPLICATE;
      const locked = await this.deps.groups.lockInTransaction(tx, input.groupId);
      if (!locked) return UNKNOWN_GROUP;
      const moved = await this.deps.groups.transitionInTransaction(
        tx,
        input.groupId,
        ["open"],
        "processing",
      );
      if (!moved) {
        return { processed: true, action: "skipped", reason: "payment_group_not_open" };
      }
      for (const member of locked.members) {
        await this.deps.payments.applyAuthorizedInTransaction(tx, member.paymentId);
      }
      await this.deps.events.withTx(tx).publish({
        aggregateType: "payment_group",
        aggregateId: input.groupId,
        eventType: "payment_group.processing",
        payload: { paymentGroupId: input.groupId },
        actorUserId: null,
        actingLegalEntityId: locked.group.buyerLegalEntityId,
      });
      recordMoneyPathEvent("payment_group_processing");
      return { processed: true, action: "payment_intent_processing" };
    });
  }

  /**
   * The group's checkout ended unpaid: every invoice still open goes back to being due on its
   * own. `eventId` is the provider event that ended it, or `null` when the platform ends it.
   */
  async release(input: {
    eventId: string | null;
    groupId: string;
    reason: PaymentGroupReleaseReason;
  }): Promise<PaymentWebhookResult> {
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (input.eventId && !(await this.deps.claims.claim(tx, input.eventId))) return DUPLICATE;
      const locked = await this.deps.groups.lockInTransaction(tx, input.groupId);
      if (!locked) return UNKNOWN_GROUP;
      if (!paymentGroupIsLive(locked.group.status)) {
        return { processed: true, action: "skipped", reason: "payment_group_not_live" };
      }
      await this.deps.groups.transitionInTransaction(tx, input.groupId, LIVE, "cancelled");
      const released = await this.deps.groups.releaseMembersInTransaction(tx, input.groupId);
      await this.deps.events.withTx(tx).publish({
        aggregateType: "payment_group",
        aggregateId: input.groupId,
        eventType: "payment_group.released",
        payload: {
          paymentGroupId: input.groupId,
          reason: input.reason,
          members: released.map((paymentId) => ({ paymentId })),
        },
        actorUserId: null,
        actingLegalEntityId: locked.group.buyerLegalEntityId,
      });
      recordMoneyPathEvent(`payment_group_released_${input.reason}`);
      return { processed: true, action: "payment_intent_canceled" };
    });
  }

  private async alertRefused(
    tx: Database,
    group: PaymentGroupRecord,
    reason: string,
    received: {
      paymentIntentId: string;
      chargeId: string | null;
      amountPence: number;
      currency: string;
    },
  ): Promise<void> {
    recordMoneyPathEvent(`payment_group_settlement_refused_${reason}`);
    console.error(
      JSON.stringify({
        msg: "payment_group_settlement_refused",
        paymentGroupId: group.id,
        reason,
        receivedAmountCents: received.amountPence,
        expectedAmountCents: gbpAmountToPence(group.totalAmount),
      }),
    );
    await this.deps.events.withTx(tx).publish({
      aggregateType: "payment_group",
      aggregateId: group.id,
      eventType: "payment_group.settlement_refused",
      payload: {
        paymentGroupId: group.id,
        reason,
        receivedAmountCents: received.amountPence,
        expectedAmountCents: gbpAmountToPence(group.totalAmount),
        currency: received.currency,
        stripePaymentIntentId: received.paymentIntentId,
        stripeChargeId: received.chargeId,
      },
      actorUserId: null,
      actingLegalEntityId: group.buyerLegalEntityId,
    });
  }
}
