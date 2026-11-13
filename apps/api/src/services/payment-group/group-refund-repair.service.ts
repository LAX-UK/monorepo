import type { Database } from "@auction/db";
import { attributeGroupRefunds } from "@auction/domain";
import type {
  IPaymentGroupRepository,
  IPaymentLifecycleRepository,
  IPaymentRefundLedger,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import type { IChargeRefundsReader } from "../stripe/stripe-charge-refunds.js";
import {
  type ChargeRefund,
  isCountedRefund,
  isReturnedNothing,
  refundCorrectionPence,
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
  paymentRefunds: IPaymentRefundLedger;
  sellerRefundedCents: (tx: Database, paymentId: string) => Promise<number>;
  payoutAdjustments: Pick<IPayoutAdjustmentService, "addPaymentLineToOpenPayoutOrCreateClawback">;
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

/**
 * The explicit repair for Pay several totals counted under the old rule, which counted a refund
 * while it was still pending: one that then failed kept the buyer's record, the seller's clawback,
 * a courier quote's refunded figure or the unattributed excess above what went back. Never run
 * automatically.
 *
 * Each group is measured against its charge's refunds as Stripe lists them now. A total above
 * what succeeded is brought down only as far as the refunds that failed or were cancelled
 * explain; anything else above Stripe is reported as unexplained and left alone. A dry run (the
 * default) writes nothing. Applied, each correction is measured under the group's lock and written
 * once (a compensating buyer row, a seller line giving back the clawback, the lowered figure and a
 * `payment.refund_reversed` notice), so running it again finds nothing to do.
 */
export class GroupRefundRepairService {
  constructor(private readonly deps: GroupRefundRepairDeps) {}

  async run(input: {
    apply: boolean;
    groupId?: string;
    limit?: number;
    batchSize?: number;
  }): Promise<GroupRefundRepairReport> {
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
        const repair = await this.repairGroup(group, input.apply);
        if (repair) report.groups.push(repair);
      }
    }
    return report;
  }

  private async repairGroup(
    group: { id: string; stripeChargeId: string },
    apply: boolean,
  ): Promise<GroupRepair | null> {
    const refunds = await this.deps.refunds.listChargeRefunds(group.stripeChargeId);
    const succeeded = refunds.filter((r) => isCountedRefund(r.status));
    const returnedNothing = refunds.filter((r) => isReturnedNothing(r.status));
    const pendingRefunds = refunds.length - succeeded.length - returnedNothing.length;

    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      const locked = await this.deps.groups.lockInTransaction(tx, group.id);
      if (!locked) return null;
      const members = [...locked.members].sort((a, b) => a.paymentId.localeCompare(b.paymentId));
      const counted = attribute(members, locked.deliveries, succeeded);
      const failed = attribute(members, locked.deliveries, returnedNothing);
      const repair: GroupRepair = {
        groupId: group.id,
        stripeChargeId: group.stripeChargeId,
        members: [],
        deliveries: [],
        unattributed: { recordedPence: 0, succeededPence: 0, correctionPence: 0 },
        unexplained: false,
        pendingRefunds,
      };

      for (const member of members) {
        const invoicePence = gbpAmountToPence(member.amount);
        await this.deps.paymentRefunds.lockPaymentInTransaction(tx, member.paymentId);
        const { pence: recordedBuyerPence } =
          await this.deps.paymentRefunds.sumRefundedPenceInTransaction(tx, member.paymentId);
        const recordedSellerPence = await this.deps.sellerRefundedCents(tx, member.paymentId);
        const succeededPence = counted.refundedPenceByPayment.get(member.paymentId) ?? 0;
        const failedPence = failed.refundedPenceByPayment.get(member.paymentId) ?? 0;
        const buyerCorrectionPence = Math.min(
          0,
          refundCorrectionPence({
            recordedPence: recordedBuyerPence,
            countedPence: succeededPence,
            returnedNothingPence: failedPence,
          }),
        );
        const sellerCorrectionPence = Math.min(
          0,
          refundCorrectionPence({
            recordedPence: Math.min(recordedSellerPence, invoicePence),
            countedPence: Math.min(succeededPence, invoicePence),
            returnedNothingPence: failedPence,
          }),
        );
        if (
          recordedBuyerPence + buyerCorrectionPence > succeededPence ||
          Math.min(recordedSellerPence, invoicePence) + sellerCorrectionPence >
            Math.min(succeededPence, invoicePence)
        ) {
          repair.unexplained = true;
        }
        if (
          recordedBuyerPence === succeededPence &&
          Math.min(recordedSellerPence, invoicePence) === Math.min(succeededPence, invoicePence)
        ) {
          continue;
        }
        repair.members.push({
          paymentId: member.paymentId,
          recordedBuyerPence,
          recordedSellerPence,
          succeededPence,
          buyerCorrectionPence,
          sellerCorrectionPence,
        });
        if (!apply || (buyerCorrectionPence === 0 && sellerCorrectionPence === 0)) continue;
        await this.applyMember(tx, group, member, {
          succeededPence,
          invoicePence,
          buyerCorrectionPence,
          sellerCorrectionPence,
          recordedBuyerPence,
          recordedSellerPence,
        });
      }

      for (const delivery of locked.deliveries) {
        const succeededPence = counted.refundedPenceByDelivery.get(delivery.quoteId) ?? 0;
        const failedPence = failed.refundedPenceByDelivery.get(delivery.quoteId) ?? 0;
        if (delivery.refundedPence === succeededPence) continue;
        const correctionPence = Math.min(
          0,
          refundCorrectionPence({
            recordedPence: delivery.refundedPence,
            countedPence: succeededPence,
            returnedNothingPence: failedPence,
          }),
        );
        if (delivery.refundedPence + correctionPence > succeededPence) repair.unexplained = true;
        repair.deliveries.push({
          quoteId: delivery.quoteId,
          recordedPence: delivery.refundedPence,
          succeededPence,
          correctionPence,
        });
        if (apply && correctionPence < 0) {
          await this.deps.groups.lowerDeliveryRefundedInTransaction(
            tx,
            group.id,
            delivery.quoteId,
            delivery.refundedPence + correctionPence,
          );
        }
      }

      const unattributedCorrection = Math.min(
        0,
        refundCorrectionPence({
          recordedPence: locked.refundUnattributedPence,
          countedPence: counted.unattributedPence,
          returnedNothingPence: failed.unattributedPence,
        }),
      );
      repair.unattributed = {
        recordedPence: locked.refundUnattributedPence,
        succeededPence: counted.unattributedPence,
        correctionPence: unattributedCorrection,
      };
      if (locked.refundUnattributedPence + unattributedCorrection > counted.unattributedPence) {
        repair.unexplained = true;
      }
      if (apply && unattributedCorrection < 0) {
        await this.deps.groups.lowerUnattributedRefundInTransaction(
          tx,
          group.id,
          locked.refundUnattributedPence + unattributedCorrection,
        );
      }

      const changed =
        repair.members.length > 0 ||
        repair.deliveries.length > 0 ||
        locked.refundUnattributedPence !== counted.unattributedPence;
      return changed ? repair : null;
    });
  }

  private async applyMember(
    tx: Database,
    group: { id: string; stripeChargeId: string },
    member: { paymentId: string; sellerLegalEntityId: string },
    m: {
      succeededPence: number;
      invoicePence: number;
      buyerCorrectionPence: number;
      sellerCorrectionPence: number;
      recordedBuyerPence: number;
      recordedSellerPence: number;
    },
  ): Promise<void> {
    // Keyed by what is corrected, so a second run (which finds nothing left) writes nothing, and
    // a later, different correction of the same invoice is a row of its own.
    const key = `refund_repair:${member.paymentId}:${m.recordedBuyerPence}:${m.recordedSellerPence}:${m.succeededPence}`;
    if (m.succeededPence < m.invoicePence) {
      await this.deps.payments.applyRefundReversedInTransaction(tx, member.paymentId);
    }
    if (m.buyerCorrectionPence < 0) {
      await this.deps.paymentRefunds.recordInTransaction(tx, {
        paymentId: member.paymentId,
        idempotencyKey: key,
        amountPence: m.buyerCorrectionPence,
        currency: "GBP",
        source: "refund_reversal",
      });
    }
    if (m.sellerCorrectionPence < 0) {
      await this.deps.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
        legalEntityId: member.sellerLegalEntityId,
        paymentId: member.paymentId,
        amount: (-m.sellerCorrectionPence / 100).toFixed(2),
        kind: "refund",
        sourceEventId: key,
        note: `Refund repair (failed refund): ${group.stripeChargeId}`,
        tx,
      });
    }
    await this.deps.events.withTx(tx).publish({
      aggregateType: "payment",
      aggregateId: member.paymentId,
      eventType: "payment.refund_reversed",
      payload: {
        stripeChargeId: group.stripeChargeId,
        amountCents: -Math.min(m.buyerCorrectionPence, m.sellerCorrectionPence),
        cumulativeRefundedCents: m.succeededPence,
        currency: "GBP",
        sellerLegalEntityId: member.sellerLegalEntityId,
        via: "refund_repair",
      },
      actorUserId: null,
      actingLegalEntityId: member.sellerLegalEntityId,
    });
  }
}
