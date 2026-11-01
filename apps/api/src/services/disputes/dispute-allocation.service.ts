import {
  type DisputeAllocationRefusal,
  decideDisputeAllocation,
  isTerminalDisputeStatus,
} from "@auction/domain";
import type {
  IDisputeCaseRepository,
  IDisputePaymentReader,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { DisputeLineEffects } from "./dispute-line-effects.js";

export type DisputeAllocationInput = {
  caseId: string;
  /** The case version the finance user saw; a case that moved on since is refused. */
  expectedVersion: number;
  lines: readonly { paymentId: string; amountPence: number }[];
  actorUserId: string;
  /** Why the finance user allocated it this way; kept on the audit event. */
  note?: string;
};

export type DisputeAllocationError =
  | DisputeAllocationRefusal
  | "not_found"
  | "already_allocated"
  | "version_conflict";

export type DisputeAllocationServiceDeps = {
  transactionRunner: ITransactionRunner;
  cases: IDisputeCaseRepository;
  payments: Pick<IDisputePaymentReader, "findByIdsInTransaction">;
  effects: DisputeLineEffects;
  events: IDomainEventSink;
};

/**
 * The finance team's allocation of a dispute across the invoices it is about. It is the only way
 * a case that needed allocating moves seller payouts: each line carries its seller's share, and
 * catches up with whatever the funds already did (withdrawn, or withdrawn and returned).
 */
export class DisputeAllocationService {
  constructor(private readonly deps: DisputeAllocationServiceDeps) {}

  allocate(
    input: DisputeAllocationInput,
  ): Promise<Result<{ caseId: string; version: number }, DisputeAllocationError>> {
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      const record = await this.deps.cases.lockByIdInTransaction(tx, input.caseId);
      if (!record) return err("not_found" as const);
      if (record.version !== input.expectedVersion) return err("version_conflict" as const);
      if (record.allocationState !== "needs_allocation") {
        return err("already_allocated" as const);
      }

      const candidatePaymentIds = await this.deps.cases.listCandidatePaymentIdsInTransaction(
        tx,
        record.id,
      );
      const invoices = await this.deps.payments.findByIdsInTransaction(
        tx,
        input.lines.map((l) => l.paymentId),
      );
      const decision = decideDisputeAllocation({
        disputedPence: record.amountPence,
        candidatePaymentIds,
        invoices,
        lines: input.lines,
      });
      if (!decision.ok) return err(decision.reason);
      if (!(await this.deps.cases.markAllocatedInTransaction(tx, record.id, record.version))) {
        return err("version_conflict" as const);
      }

      const lines = await this.deps.cases.insertAllocationsInTransaction(
        tx,
        record.id,
        decision.lines.map((line) => ({
          ...line,
          clawback: "none" as const,
          source: "staff" as const,
          allocatedByUserId: input.actorUserId,
        })),
      );
      await this.deps.effects.publishOpened(tx, record, lines);
      await this.deps.effects.reconcile(tx, record, lines, "Dispute funds reinstated");
      if (isTerminalDisputeStatus(record.status)) {
        await this.deps.effects.publishClosed(tx, record, lines);
      }
      await this.deps.events.withTx(tx).publish({
        aggregateType: "dispute_case",
        aggregateId: record.id,
        eventType: "dispute_case.allocated",
        payload: {
          disputeCaseId: record.id,
          stripeDisputeId: record.stripeDisputeId,
          amountCents: record.amountPence,
          currency: record.currency,
          lines: lines.map((l) => ({
            paymentId: l.paymentId,
            sellerLegalEntityId: l.sellerLegalEntityId,
            amountCents: l.amountPence,
            sellerShareCents: l.sellerSharePence,
          })),
          ...(input.note ? { note: input.note } : {}),
        },
        actorUserId: input.actorUserId,
        actingLegalEntityId: null,
      });
      return ok({ caseId: record.id, version: record.version + 1 });
    });
  }
}
