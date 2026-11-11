import type { Database } from "@auction/db";
import {
  type PaymentGroupStatus,
  decidePaymentGroupSettlement,
  paymentGroupIsLive,
} from "@auction/domain";
import type { IPaymentEligibilityGate } from "@auction/finance-runtime";
import type {
  IPaymentGroupRepository,
  IPaymentLifecycleRepository,
  ITransactionRunner,
  PaymentGroupDelivery,
  PaymentGroupMember,
  PaymentGroupRecord,
} from "@auction/persistence/interfaces";
import { gbpAmountToPence, gbpPenceToMajorString } from "../../lib/decimal-money.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IErrorReporter } from "../interfaces/error-handling.js";
import type { IPaymentCaptureInTransaction } from "../interfaces/payment-capture.js";
import { runAfterCapture } from "../payment/run-after-capture.js";
import type { IUnappliedMoneyRecorder } from "../payment/unapplied-money.recorder.js";
import type { PaymentWebhookResult } from "../stripe-webhook/payment-webhook-types.js";

/** Records a provider event as handled inside `tx`; `false` when it was handled before. */
export interface IProviderEventClaim {
  claim(tx: Database, eventId: string): Promise<boolean>;
}

/** The one receipt for a group's payment, sent once it is paid. */
export interface IPaymentGroupReceipt {
  send(
    group: PaymentGroupRecord,
    members: readonly PaymentGroupMember[],
    deliveries: readonly PaymentGroupDelivery[],
  ): Promise<void>;
}

/** Why a group was let go before it was paid. */
export type PaymentGroupReleaseReason =
  | "checkout_cancelled"
  | "checkout_expired"
  /** The payer walked away and started again, possibly by another method. */
  | "checkout_abandoned"
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
  /** The finance task for money that arrived but could not settle the group. */
  unappliedMoney: Pick<IUnappliedMoneyRecorder, "record">;
  /** The same gate single-invoice payments use: a held or closed account's money is not captured. */
  eligibility: IPaymentEligibilityGate;
  /** Where a capture's failed follow-up steps are reported; they never fail the webhook. */
  errorReporter?: IErrorReporter;
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
    // Read before the transaction opens; a failed read throws, so the provider retries the event.
    const blocked = await this.accountBlock(input.groupId);
    let paid: {
      group: PaymentGroupRecord;
      members: PaymentGroupMember[];
      deliveries: PaymentGroupDelivery[];
    } | null = null;

    const result = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (!(await this.deps.claims.claim(tx, input.eventId))) return DUPLICATE;
      const locked = await this.deps.groups.lockInTransaction(tx, input.groupId);
      if (!locked) return UNKNOWN_GROUP;
      const { group, members, deliveries } = locked;

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
        deliveries: deliveries.map((d) => ({
          quoteId: d.quoteId,
          amountPence: gbpAmountToPence(d.amount),
        })),
        received: { amountPence: input.amountPence, currency: input.currency },
      });
      if (!decision.apply) {
        if (decision.alert) {
          await this.alertRefused(tx, group, decision.reason, input);
        }
        return { processed: true, action: "skipped", reason: decision.reason } as const;
      }
      // Nothing is captured for an account that cannot pay: finance decides what happens to it.
      if (blocked) {
        const reason = `account_${blocked}`;
        await this.alertRefused(tx, group, reason, input);
        return { processed: true, action: "skipped", reason } as const;
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
      paid = { group, members, deliveries };
      return { processed: true, action: "payment_intent_succeeded" } as const;
    });

    for (const run of afterCommit) {
      await runAfterCapture(run, { paymentGroupId: input.groupId }, this.deps.errorReporter);
    }
    const settled = paid as {
      group: PaymentGroupRecord;
      members: PaymentGroupMember[];
      deliveries: PaymentGroupDelivery[];
    } | null;
    if (settled) {
      await this.deps.receipt.send(settled.group, settled.members, settled.deliveries);
      recordMoneyPathEvent("payment_group_paid");
    }
    return result;
  }

  /**
   * Why the paying account cannot pay now (identity, organisation review, closed), or null. A
   * group with no recorded payer is not payable. An unknown group is left to `settle` to report.
   */
  private async accountBlock(groupId: string): Promise<string | null> {
    const group = await this.deps.groups.findById(groupId);
    if (!group) return null;
    if (!group.createdByUserId) return "payer_unknown";
    const eligibility = await this.deps.eligibility.check({
      payerUserId: group.createdByUserId,
      buyerLegalEntityId: group.buyerLegalEntityId,
    });
    return eligibility.kind === "payable" ? null : eligibility.reason;
  }

  /**
   * A bank transfer was started for the group, or part of it arrived: its invoices are held while
   * the money travels. `received` is what the provider says has arrived so far and when it said
   * so; it is stored (only ever raised, never from an older event than the last) so the payer and
   * their Money page can say what is still to send. Nothing is marked paid until all of it is in.
   */
  async markProcessing(input: {
    eventId: string;
    groupId: string;
    received?: { amountPence: number; paymentIntentId: string; eventAt: Date };
  }): Promise<PaymentWebhookResult> {
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (!(await this.deps.claims.claim(tx, input.eventId))) return DUPLICATE;
      const locked = await this.deps.groups.lockInTransaction(tx, input.groupId);
      if (!locked) return UNKNOWN_GROUP;
      if (!paymentGroupIsLive(locked.group.status)) {
        return { processed: true, action: "skipped", reason: "payment_group_not_open" };
      }
      const moved = await this.deps.groups.transitionInTransaction(
        tx,
        input.groupId,
        ["open"],
        "processing",
      );
      if (moved) {
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
      }
      const recorded = input.received
        ? await this.deps.groups.recordReceivedInTransaction(tx, input.groupId, {
            amount: gbpPenceToMajorString(input.received.amountPence),
            eventAt: input.received.eventAt,
          })
        : false;
      if (recorded && input.received) {
        await this.deps.events.withTx(tx).publish({
          aggregateType: "payment_group",
          aggregateId: input.groupId,
          eventType: "payment_group.bank_transfer_partially_funded",
          payload: {
            paymentGroupId: input.groupId,
            receivedCents: input.received.amountPence,
            totalCents: gbpAmountToPence(locked.group.totalAmount),
            currency: locked.group.currency,
          },
          actorUserId: null,
          actingLegalEntityId: locked.group.buyerLegalEntityId,
        });
        recordMoneyPathEvent("payment_group_part_received");
      }
      await this.alertIfOverpaid(tx, locked.group, input.received);
      if (!moved && !recorded) {
        return { processed: true, action: "skipped", reason: "payment_group_not_open" };
      }
      return {
        processed: true,
        action: recorded ? "payment_intent_partially_funded" : "payment_intent_processing",
      };
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
    /**
     * Release only a group that still has no checkout recorded. A start that was slow may have
     * recorded its checkout since the caller looked; that checkout can be paid, so the group is
     * left as it is (`checkout_recorded`) for the caller to end through the provider first.
     */
    onlyIfNoCheckout?: boolean;
  }): Promise<PaymentWebhookResult> {
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (input.eventId && !(await this.deps.claims.claim(tx, input.eventId))) return DUPLICATE;
      const locked = await this.deps.groups.lockInTransaction(tx, input.groupId);
      if (!locked) return UNKNOWN_GROUP;
      if (!paymentGroupIsLive(locked.group.status)) {
        return { processed: true, action: "skipped", reason: "payment_group_not_live" };
      }
      if (input.onlyIfNoCheckout && locked.group.stripeCheckoutSessionId) {
        return { processed: true, action: "skipped", reason: "checkout_recorded" };
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

  /**
   * A guard: the provider reports money received beyond the group's total. In practice an
   * overpayment arrives as money left in the buyer's balance (see the cash-balance handler); this
   * catches the figure should the intent ever report it. A finance task, never a refund.
   */
  private async alertIfOverpaid(
    tx: Database,
    group: PaymentGroupRecord,
    received: { amountPence: number; paymentIntentId: string } | undefined,
  ): Promise<void> {
    if (!received) return;
    const excess = received.amountPence - gbpAmountToPence(group.totalAmount);
    if (excess <= 0) return;
    recordMoneyPathEvent("payment_group_overpaid");
    await this.deps.unappliedMoney.record(
      tx,
      {
        reason: "group_overpaid",
        paymentId: null,
        paymentGroupId: group.id,
        stripePaymentIntentId: received.paymentIntentId,
        stripeChargeId: null,
        stripeCustomerId: null,
        amountCents: excess,
        currency: group.currency,
      },
      group.buyerLegalEntityId,
    );
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
    await this.deps.unappliedMoney.record(
      tx,
      {
        reason: "group_not_settleable",
        paymentId: null,
        paymentGroupId: group.id,
        stripePaymentIntentId: received.paymentIntentId,
        stripeChargeId: received.chargeId,
        stripeCustomerId: null,
        amountCents: received.amountPence,
        currency: received.currency,
      },
      group.buyerLegalEntityId,
    );
  }
}
