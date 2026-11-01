import type { Database } from "@auction/db";
import {
  type DisputeAllocationLine,
  type DisputeStage,
  disputeFundsAfter,
  isNewerDisputeSnapshot,
  planAutomaticDisputeAllocation,
} from "@auction/domain";
import type {
  DisputeCaseRecord,
  DisputeStripeSnapshot,
  IDisputeCaseRepository,
  IDisputePaymentReader,
  ITransactionRunner,
  LegacyDisputeLine,
  NewDisputeAllocation,
  NewDisputeCase,
} from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IProviderEventClaim } from "../payment-group/payment-group-settlement.service.js";
import type { PaymentWebhookResult } from "../stripe-webhook/payment-webhook-types.js";
import { type DisputeLineEffects, disputeFundsOf } from "./dispute-line-effects.js";
import {
  disputeChargeId,
  disputeCreatedAt,
  disputePaymentIntentId,
  disputeSnapshotFromStripe,
} from "./stripe-dispute-snapshot.js";

export type DisputeCaseRecorderDeps = {
  transactionRunner: ITransactionRunner;
  claims: IProviderEventClaim;
  cases: IDisputeCaseRepository;
  payments: IDisputePaymentReader;
  effects: DisputeLineEffects;
  events: IDomainEventSink;
  now?: () => Date;
};

/** Records every dispute webhook against Bid's charges; one class per webhook entry point. */
export interface IDisputeWebhookRecorder {
  record(
    stage: DisputeStage,
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult>;
}

const ACTION: Record<DisputeStage, NonNullable<PaymentWebhookResult["action"]>> = {
  created: "dispute_created",
  updated: "dispute_updated",
  funds_withdrawn: "dispute_funds_withdrawn",
  funds_reinstated: "dispute_funds_reinstated",
  closed: "dispute_closed",
};

const DUPLICATE: PaymentWebhookResult = {
  processed: false,
  action: "skipped",
  reason: "duplicate_event",
};

/** The allocation a newly seen dispute starts with. */
type OpeningPlan =
  /** Rebuilt from what the ledger already holds for a dispute seen before cases existed. */
  | { kind: "legacy"; lines: LegacyDisputeLine[] }
  | { kind: "automatic"; lines: DisputeAllocationLine[]; candidateIds: string[] }
  | { kind: "needs_allocation"; candidateIds: string[] };

/**
 * Turns Stripe's dispute webhooks into dispute cases. Every dispute is recorded, matched or not.
 * A charge that paid one invoice is allocated to it at once and moves that seller's payout as
 * the funds move. A charge that paid several invoices, or none, waits for the finance team to
 * allocate it, and no payout moves until they do. Out-of-order and repeated webhooks are safe:
 * an older copy of the dispute never overwrites a newer one, and each payout move happens once.
 */
export class DisputeCaseRecorder implements IDisputeWebhookRecorder {
  private readonly now: () => Date;

  constructor(private readonly deps: DisputeCaseRecorderDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async record(
    stage: DisputeStage,
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult> {
    const chargeId = disputeChargeId(dispute);
    if (!chargeId) return { processed: false, reason: "missing_charge_id" };

    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (!(await this.deps.claims.claim(tx, event.id))) return DUPLICATE;
      const snapshot = disputeSnapshotFromStripe(event, dispute, this.now());

      const existing = await this.deps.cases.lockByStripeIdInTransaction(tx, dispute.id);
      const record = existing
        ? await this.refresh(tx, existing, snapshot)
        : await this.open(tx, dispute, chargeId, snapshot);
      const withFunds = await this.applyFunds(tx, record, stage);

      if (withFunds.allocationState === "allocated") {
        const lines = await this.deps.cases.listAllocationsInTransaction(tx, withFunds.id);
        await this.deps.effects.reconcile(
          tx,
          withFunds,
          lines,
          stage === "closed" ? "Dispute won — reverse clawback" : "Dispute funds reinstated",
        );
        if (stage === "closed") await this.deps.effects.publishClosed(tx, withFunds, lines);
        return { processed: true, action: ACTION[stage] };
      }
      return { processed: true, action: ACTION[stage], reason: "needs_allocation" };
    });
  }

  /** Keeps Stripe's newest copy; an older webhook never rolls the case back. */
  private async refresh(
    tx: Database,
    record: DisputeCaseRecord,
    snapshot: DisputeStripeSnapshot,
  ): Promise<DisputeCaseRecord> {
    if (!isNewerDisputeSnapshot(record.lastEventAt, snapshot.eventAt)) return record;
    const applied: DisputeStripeSnapshot = {
      ...snapshot,
      closedAt: snapshot.closedAt ? (record.closedAt ?? snapshot.closedAt) : null,
    };
    await this.deps.cases.applySnapshotInTransaction(tx, record.id, applied);
    return {
      ...record,
      status: applied.status,
      amountPence: applied.amountPence,
      currency: applied.currency,
      reason: applied.reason,
      networkReasonCode: applied.networkReasonCode,
      cardBrand: applied.cardBrand,
      cardLast4: applied.cardLast4,
      dueBy: applied.dueBy,
      evidenceSubmitted: applied.evidenceSubmitted,
      chargeRefundable: applied.chargeRefundable,
      lastEventAt: applied.eventAt,
      closedAt: applied.closedAt,
    };
  }

  /** Records a dispute seen for the first time, with the allocation it starts with. */
  private async open(
    tx: Database,
    dispute: Stripe.Dispute,
    chargeId: string,
    snapshot: DisputeStripeSnapshot,
  ): Promise<DisputeCaseRecord> {
    const plan = await this.planOpening(tx, dispute, chargeId, snapshot.amountPence);
    const legacy = plan.kind === "legacy" ? plan.lines : [];
    const input: NewDisputeCase = {
      stripeDisputeId: dispute.id,
      stripeChargeId: chargeId,
      stripePaymentIntentId: disputePaymentIntentId(dispute),
      stripeCreatedAt: disputeCreatedAt(dispute, snapshot.eventAt),
      allocationState: plan.kind === "needs_allocation" ? "needs_allocation" : "allocated",
      snapshot,
      fundsWithdrawnAt: legacy.some((l) => l.clawback !== "none") ? snapshot.eventAt : null,
      fundsReinstatedAt: legacy.some((l) => l.clawback === "reversed") ? snapshot.eventAt : null,
      candidatePaymentIds:
        plan.kind === "legacy" ? legacy.map((l) => l.paymentId) : plan.candidateIds,
    };
    const { record, created } = await this.deps.cases.insertOrLockInTransaction(tx, input);
    if (!created) return this.refresh(tx, record, snapshot);

    if (plan.kind === "needs_allocation") {
      await this.announceNeedsAllocation(tx, record, plan.candidateIds);
      return record;
    }
    const lines = await this.deps.cases.insertAllocationsInTransaction(
      tx,
      record.id,
      plan.kind === "legacy"
        ? plan.lines.map((l) => ({ ...l, source: "legacy", allocatedByUserId: null }))
        : plan.lines.map(
            (l): NewDisputeAllocation => ({
              ...l,
              clawback: "none",
              source: "automatic",
              allocatedByUserId: null,
            }),
          ),
    );
    // A legacy dispute's lines were announced when the ledger first moved.
    if (plan.kind === "automatic") await this.deps.effects.publishOpened(tx, record, lines);
    return record;
  }

  private async planOpening(
    tx: Database,
    dispute: Stripe.Dispute,
    chargeId: string,
    disputedPence: number,
  ): Promise<OpeningPlan> {
    const legacy = await this.deps.payments.legacyLinesInTransaction(tx, dispute.id);
    if (legacy.length > 0) return { kind: "legacy", lines: legacy };
    const candidates = await this.deps.payments.listByChargeInTransaction(tx, {
      chargeId,
      paymentIntentId: disputePaymentIntentId(dispute),
    });
    const candidateIds = candidates.map((c) => c.paymentId);
    const lines = planAutomaticDisputeAllocation(disputedPence, candidates);
    return lines
      ? { kind: "automatic", lines, candidateIds }
      : { kind: "needs_allocation", candidateIds };
  }

  private async applyFunds(
    tx: Database,
    record: DisputeCaseRecord,
    stage: DisputeStage,
  ): Promise<DisputeCaseRecord> {
    const before = disputeFundsOf(record);
    const after = disputeFundsAfter(stage, record.status, before);
    if (after.withdrawn === before.withdrawn && after.reinstated === before.reinstated) {
      return record;
    }
    const at = this.now();
    const funds = {
      fundsWithdrawnAt: after.withdrawn ? (record.fundsWithdrawnAt ?? at) : null,
      fundsReinstatedAt: after.reinstated ? (record.fundsReinstatedAt ?? at) : null,
    };
    await this.deps.cases.recordFundsInTransaction(tx, record.id, funds);
    return { ...record, ...funds };
  }

  private async announceNeedsAllocation(
    tx: Database,
    record: DisputeCaseRecord,
    candidateIds: readonly string[],
  ): Promise<void> {
    recordMoneyPathEvent(
      candidateIds.length === 0
        ? "dispute_case_no_matching_payment"
        : "dispute_case_needs_allocation",
    );
    await this.deps.events.withTx(tx).publish({
      aggregateType: "dispute_case",
      aggregateId: record.id,
      eventType: "dispute_case.needs_allocation",
      payload: {
        disputeCaseId: record.id,
        stripeDisputeId: record.stripeDisputeId,
        stripeChargeId: record.stripeChargeId,
        amountCents: record.amountPence,
        currency: record.currency,
        reason: record.reason,
        candidateCount: candidateIds.length,
      },
      actorUserId: null,
      actingLegalEntityId: null,
    });
  }
}
