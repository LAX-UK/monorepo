import type { Database } from "@auction/db";
import { attributeGroupRefunds } from "@auction/domain";
import type {
  IPaymentGroupRepository,
  IPaymentLifecycleRepository,
  IPaymentRefundLedger,
  IRefundReversalLedger,
  ITransactionRunner,
  LockedPaymentGroup,
  RefundReversalTarget,
} from "@auction/persistence/interfaces";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import { takeBackFailedRefunds } from "../payment/take-back-failed-refunds.js";
import type { IChargeRefundsReader } from "../stripe/stripe-charge-refunds.js";
import {
  type ChargeRefund,
  type ReversibleRefund,
  allocateRefundReversal,
  isCountedRefund,
  isReturnedNothing,
  refundCorrectionPence,
  reversibleRefunds,
  sumReversiblePence,
} from "../stripe/stripe-refund-status.js";

export type GroupRefundRepairDeps = {
  transactionRunner: ITransactionRunner;
  groups: Pick<
    IPaymentGroupRepository,
    | "listChargedGroupsWithRefunds"
    | "lockInTransaction"
    | "lowerDeliveryRefundedInTransaction"
    | "lowerUnattributedRefundInTransaction"
  >;
  refunds: Pick<IChargeRefundsReader, "listChargeRefunds">;
  payments: Pick<IPaymentLifecycleRepository, "applyRefundReversedInTransaction">;
  paymentRefunds: IPaymentRefundLedger & IRefundReversalLedger;
  sellerRefundedCents: (tx: Database, paymentId: string) => Promise<number>;
  payoutAdjustments: Pick<
    IPayoutAdjustmentService,
    "giveBackFailedRefund" | "lockOpenPayoutsForSellers"
  >;
  events: IDomainEventSink;
};

export type MemberRepair = {
  paymentId: string;
  recordedBuyerPence: number;
  recordedSellerPence: number;
  /** What Stripe lists as succeeded for this invoice. */
  succeededPence: number;
  /** Below zero: what is taken back. Zero: in step, or above Stripe with no failed refund to explain it. */
  buyerCorrectionPence: number;
  sellerCorrectionPence: number;
};

export type GroupRepair = {
  groupId: string;
  stripeChargeId: string;
  members: MemberRepair[];
  deliveries: {
    quoteId: string;
    recordedPence: number;
    succeededPence: number;
    correctionPence: number;
  }[];
  unattributed: { recordedPence: number; succeededPence: number; correctionPence: number };
  /** Something is recorded above Stripe that no failed refund explains: for finance to look at. */
  unexplained: boolean;
  /** A refund on the charge is still pending: left for the reconcile job, not repaired now. */
  pendingRefunds: number;
};

export type GroupRefundRepairReport = {
  apply: boolean;
  checked: number;
  groups: GroupRepair[];
};

/** A dry run, or an applied run with the staff member who runs it (recorded on every change). */
export type GroupRefundRepairRun =
  | { apply: false; operatorUserId?: string | null }
  | { apply: true; operatorUserId: string };

function attribute(
  members: readonly { paymentId: string; amount: string }[],
  deliveries: readonly { quoteId: string; amount: string }[],
  refunds: readonly ChargeRefund[],
) {
  return attributeGroupRefunds(
    members.map((m) => ({ paymentId: m.paymentId, amountPence: gbpAmountToPence(m.amount) })),
    refunds.map((r) => ({
      paymentId: r.paymentId,
      deliveryQuoteId: r.deliveryQuoteId,
      amountPence: r.amountPence,
    })),
    deliveries.map((d) => ({ quoteId: d.quoteId, amountPence: gbpAmountToPence(d.amount) })),
  );
}

/** The failed or cancelled refunds on a group's charge, split by the record each one counted on. */
type FailedRefundsByRecord = {
  byPayment: Map<string, ChargeRefund[]>;
  byDelivery: Map<string, ChargeRefund[]>;
  unattributed: ChargeRefund[];
};

/**
 * Attributes each failed refund on its own, as the webhook attributes refunds, so every record
 * knows which Stripe refunds (and how much of each) it may have counted: the key a reversal is
 * written once under.
 */
function failedRefundsByRecord(
  members: readonly { paymentId: string; amount: string }[],
  deliveries: readonly { quoteId: string; amount: string }[],
  refunds: readonly ChargeRefund[],
): FailedRefundsByRecord {
  const split: FailedRefundsByRecord = {
    byPayment: new Map(),
    byDelivery: new Map(),
    unattributed: [],
  };
  const add = (into: Map<string, ChargeRefund[]>, key: string, refund: ChargeRefund) =>
    into.set(key, [...(into.get(key) ?? []), refund]);
  for (const refund of refunds) {
    const one = attribute(members, deliveries, [refund]);
    for (const [paymentId, amountPence] of one.refundedPenceByPayment) {
      add(split.byPayment, paymentId, { ...refund, amountPence });
    }
    for (const [quoteId, amountPence] of one.refundedPenceByDelivery) {
      add(split.byDelivery, quoteId, { ...refund, amountPence });
    }
    if (one.unattributedPence > 0) {
      split.unattributed.push({ ...refund, amountPence: one.unattributedPence });
    }
  }
  return split;
}

/**
 * The explicit repair for Pay several totals counted under the old rule, which counted a refund
 * while it was still pending: one that then failed kept the buyer's record, the seller's clawback,
 * a courier quote's refunded figure or the unattributed excess above what went back. Never run
 * automatically.
 *
 * Each group is measured, under its lock, against its charge's refunds as Stripe lists them at
 * that moment. A total above what succeeded is brought down only as far as refunds that failed or
 * were cancelled, and have not been taken back from that record yet, explain; anything else above
 * Stripe is reported as unexplained and left alone. A dry run (the default) writes nothing.
 * Applied, each failed refund is taken back from each record at most once (keyed by the Stripe
 * refund in the reversal ledger, shared with the webhook and the reconcile job): a compensating
 * buyer row, a seller line giving back the clawback, the lowered courier or unattributed figure,
 * each announced with the operator who ran it. Running it again writes nothing.
 */
export class GroupRefundRepairService {
  constructor(private readonly deps: GroupRefundRepairDeps) {}

  async run(
    input: GroupRefundRepairRun & { groupId?: string; limit?: number; batchSize?: number },
  ): Promise<GroupRefundRepairReport> {
    if (input.apply && !input.operatorUserId) {
      throw new Error("An applied repair needs the operator (staff user id) who runs it");
    }
    const operatorUserId = input.apply ? input.operatorUserId : null;
    const report: GroupRefundRepairReport = { apply: input.apply, checked: 0, groups: [] };
    const limit = input.limit ?? Number.POSITIVE_INFINITY;
    let afterId: string | null = null;
    while (report.checked < limit) {
      const batch = await this.deps.groups.listChargedGroupsWithRefunds({
        afterId,
        limit: input.batchSize ?? 100,
      });
      if (batch.length === 0) break;
      for (const group of batch) {
        afterId = group.id;
        if (input.groupId && group.id !== input.groupId) continue;
        if (report.checked >= limit) break;
        report.checked += 1;
        const repair = await this.repairGroup(group, operatorUserId);
        if (repair) report.groups.push(repair);
      }
    }
    return report;
  }

  /** `operatorUserId` set: apply. Null: dry run. */
  private repairGroup(
    group: { id: string; stripeChargeId: string },
    operatorUserId: string | null,
  ): Promise<GroupRepair | null> {
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      const locked = await this.deps.groups.lockInTransaction(tx, group.id);
      if (!locked) return null;
      // Read while the group is held, so no event can record a refund between the read and the
      // correction: a list read earlier could show a refund as pending that has since succeeded
      // and been counted, and a real refund would then look unexplained or be taken back.
      const refunds = await this.deps.refunds.listChargeRefunds(group.stripeChargeId);
      const succeeded = refunds.filter((r) => isCountedRefund(r.status));
      const returnedNothing = refunds.filter((r) => isReturnedNothing(r.status));
      const members = [...locked.members].sort((a, b) => a.paymentId.localeCompare(b.paymentId));
      // A repair that applies gives back to several sellers in one transaction: their payouts are
      // held in one order first, as a group refund holds them (a dry run moves none).
      if (operatorUserId !== null) {
        await this.deps.payoutAdjustments.lockOpenPayoutsForSellers({
          legalEntityIds: members.map((m) => m.sellerLegalEntityId),
          tx,
        });
      }
      const counted = attribute(members, locked.deliveries, succeeded);
      const failed = failedRefundsByRecord(members, locked.deliveries, returnedNothing);
      const repair: GroupRepair = {
        groupId: group.id,
        stripeChargeId: group.stripeChargeId,
        members: [],
        deliveries: [],
        unattributed: { recordedPence: 0, succeededPence: 0, correctionPence: 0 },
        unexplained: false,
        pendingRefunds: refunds.length - succeeded.length - returnedNothing.length,
      };
      const run: RepairStep = { tx, group, locked, operatorUserId, repair };

      for (const member of members) {
        await this.repairMember(
          run,
          member,
          counted.refundedPenceByPayment.get(member.paymentId) ?? 0,
          failed.byPayment.get(member.paymentId) ?? [],
        );
      }
      for (const delivery of locked.deliveries) {
        await this.repairDelivery(
          run,
          delivery,
          counted.refundedPenceByDelivery.get(delivery.quoteId) ?? 0,
          failed.byDelivery.get(delivery.quoteId) ?? [],
        );
      }
      await this.repairUnattributed(run, counted.unattributedPence, failed.unattributed);

      const changed =
        repair.members.length > 0 ||
        repair.deliveries.length > 0 ||
        locked.refundUnattributedPence !== counted.unattributedPence;
      return changed ? repair : null;
    });
  }

  private async repairMember(
    run: RepairStep,
    member: { paymentId: string; sellerLegalEntityId: string; amount: string },
    succeededPence: number,
    failed: readonly ChargeRefund[],
  ): Promise<void> {
    const { tx, repair } = run;
    const invoicePence = gbpAmountToPence(member.amount);
    await this.deps.paymentRefunds.lockPaymentInTransaction(tx, member.paymentId);
    const { pence: recordedBuyerPence } =
      await this.deps.paymentRefunds.sumRefundedPenceInTransaction(tx, member.paymentId);
    const recordedSellerPence = await this.deps.sellerRefundedCents(tx, member.paymentId);
    const buyerReversible = await this.reversible(
      tx,
      { kind: "buyer", id: member.paymentId },
      failed,
    );
    const sellerReversible = await this.reversible(
      tx,
      { kind: "seller", id: member.paymentId },
      failed,
    );
    const sellerRecorded = Math.min(recordedSellerPence, invoicePence);
    const sellerSucceeded = Math.min(succeededPence, invoicePence);
    const buyerCorrectionPence = Math.min(
      0,
      refundCorrectionPence({
        recordedPence: recordedBuyerPence,
        countedPence: succeededPence,
        reversiblePence: sumReversiblePence(buyerReversible),
      }),
    );
    const sellerCorrectionPence = Math.min(
      0,
      refundCorrectionPence({
        recordedPence: sellerRecorded,
        countedPence: sellerSucceeded,
        reversiblePence: sumReversiblePence(sellerReversible),
      }),
    );
    if (
      recordedBuyerPence + buyerCorrectionPence > succeededPence ||
      sellerRecorded + sellerCorrectionPence > sellerSucceeded
    ) {
      repair.unexplained = true;
    }
    if (recordedBuyerPence === succeededPence && sellerRecorded === sellerSucceeded) return;
    repair.members.push({
      paymentId: member.paymentId,
      recordedBuyerPence,
      recordedSellerPence,
      succeededPence,
      buyerCorrectionPence,
      sellerCorrectionPence,
    });
    if (!run.operatorUserId || (buyerCorrectionPence === 0 && sellerCorrectionPence === 0)) return;

    const taken = await takeBackFailedRefunds(this.deps, tx, {
      paymentId: member.paymentId,
      sellerLegalEntityId: member.sellerLegalEntityId,
      currency: "GBP",
      buyer: allocateRefundReversal(-buyerCorrectionPence, buyerReversible),
      seller: allocateRefundReversal(-sellerCorrectionPence, sellerReversible),
      note: `Refund repair (failed refund): ${run.group.stripeChargeId}`,
    });
    if (taken.buyerPence === 0 && taken.sellerRefundPence === 0) return;
    if (succeededPence < invoicePence) {
      await this.deps.payments.applyRefundReversedInTransaction(tx, member.paymentId);
    }
    await this.deps.events.withTx(tx).publish({
      aggregateType: "payment",
      aggregateId: member.paymentId,
      eventType: "payment.refund_reversed",
      payload: {
        stripeChargeId: run.group.stripeChargeId,
        amountCents: Math.max(taken.buyerPence, taken.sellerRefundPence),
        // What the seller was given back: their share of the reversed refund that they had been
        // charged, which is less than the buyer's refund for a sale paid from its snapshot.
        sellerAmountCents: taken.sellerPence,
        cumulativeRefundedCents: succeededPence,
        currency: "GBP",
        sellerLegalEntityId: member.sellerLegalEntityId,
        via: "refund_repair",
      },
      actorUserId: run.operatorUserId,
      actingLegalEntityId: member.sellerLegalEntityId,
    });
  }

  private async repairDelivery(
    run: RepairStep,
    delivery: { quoteId: string; refundedPence: number },
    succeededPence: number,
    failed: readonly ChargeRefund[],
  ): Promise<void> {
    if (delivery.refundedPence === succeededPence) return;
    const target = { kind: "delivery", id: delivery.quoteId } as const;
    const reversible = await this.reversible(run.tx, target, failed);
    const correctionPence = Math.min(
      0,
      refundCorrectionPence({
        recordedPence: delivery.refundedPence,
        countedPence: succeededPence,
        reversiblePence: sumReversiblePence(reversible),
      }),
    );
    if (delivery.refundedPence + correctionPence > succeededPence) run.repair.unexplained = true;
    run.repair.deliveries.push({
      quoteId: delivery.quoteId,
      recordedPence: delivery.refundedPence,
      succeededPence,
      correctionPence,
    });
    await this.lowerFigure(run, target, delivery.refundedPence, reversible, correctionPence, (to) =>
      this.deps.groups.lowerDeliveryRefundedInTransaction(
        run.tx,
        run.group.id,
        delivery.quoteId,
        to,
      ),
    );
  }

  private async repairUnattributed(
    run: RepairStep,
    succeededPence: number,
    failed: readonly ChargeRefund[],
  ): Promise<void> {
    const recordedPence = run.locked.refundUnattributedPence;
    const target = { kind: "unattributed", id: run.group.id } as const;
    const reversible = await this.reversible(run.tx, target, failed);
    const correctionPence = Math.min(
      0,
      refundCorrectionPence({
        recordedPence,
        countedPence: succeededPence,
        reversiblePence: sumReversiblePence(reversible),
      }),
    );
    run.repair.unattributed = { recordedPence, succeededPence, correctionPence };
    if (recordedPence + correctionPence > succeededPence) run.repair.unexplained = true;
    await this.lowerFigure(run, target, recordedPence, reversible, correctionPence, (to) =>
      this.deps.groups.lowerUnattributedRefundInTransaction(run.tx, run.group.id, to),
    );
  }

  /**
   * Applied runs only: takes the failed refunds back from a courier quote's or the group's
   * unattributed figure, each refund claimed once in the reversal ledger, lowers the figure by
   * what was claimed and announces it with the operator.
   */
  private async lowerFigure(
    run: RepairStep,
    target: RefundReversalTarget,
    recordedPence: number,
    reversible: readonly ReversibleRefund[],
    correctionPence: number,
    lower: (toPence: number) => Promise<boolean>,
  ): Promise<void> {
    if (!run.operatorUserId || correctionPence >= 0) return;
    let takenPence = 0;
    for (const share of allocateRefundReversal(-correctionPence, reversible)) {
      if (await this.deps.paymentRefunds.recordReversalInTransaction(run.tx, target, share)) {
        takenPence += share.amountPence;
      }
    }
    if (takenPence === 0) return;
    if (!(await lower(recordedPence - takenPence))) {
      // Measured under the group's lock, so it cannot have moved; never keep a claim it lacks.
      throw new Error(`Refund figure of group ${run.group.id} changed under its lock`);
    }
    await this.deps.events.withTx(run.tx).publish({
      aggregateType: "payment_group",
      aggregateId: run.group.id,
      eventType: "payment_group.refund_reversed",
      payload: {
        paymentGroupId: run.group.id,
        stripeChargeId: run.group.stripeChargeId,
        deliveryQuoteId: target.kind === "delivery" ? target.id : null,
        amountCents: takenPence,
        previousCents: recordedPence,
        correctedCents: recordedPence - takenPence,
        currency: "GBP",
        via: "refund_repair",
      },
      actorUserId: run.operatorUserId,
      actingLegalEntityId: run.locked.group.buyerLegalEntityId,
    });
  }

  private async reversible(
    tx: Database,
    target: RefundReversalTarget,
    failed: readonly ChargeRefund[],
  ): Promise<ReversibleRefund[]> {
    return reversibleRefunds(
      failed,
      await this.deps.paymentRefunds.reversedRefundIdsInTransaction(tx, target),
    );
  }
}

/** One group being repaired, under its lock. */
type RepairStep = {
  tx: Database;
  group: { id: string; stripeChargeId: string };
  locked: LockedPaymentGroup;
  /** Set: the run applies and records this operator. Null: dry run. */
  operatorUserId: string | null;
  repair: GroupRepair;
};
