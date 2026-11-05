import type { Database } from "@auction/db";
import type {
  ISourceOfFundsRepository,
  ITransactionRunner,
  SourceOfFundsCase,
  SourceOfFundsTrigger,
} from "@auction/persistence/interfaces";
import type { DomainEventConnection, DomainEventInput } from "@auction/persistence/lib";
import type {
  ISourceOfFundsGate,
  SettlementComplianceInput,
} from "./settlement-compliance.policy.js";

export type SourceOfFundsConfig = {
  /** SoF threshold in GBP major units (no FX; platform is GBP-only). */
  thresholdAmount: number;
  currency: string;
  /** Days an approved SoF case clears future settlements before re-validation. */
  approvalValidityDays: number;
};

/** Publishes the "source of funds required" event inside the transaction that opens the case. */
export interface ISourceOfFundsEventSink {
  withTx(tx: DomainEventConnection): { publish(event: DomainEventInput): Promise<void> };
}

export const SOURCE_OF_FUNDS_REQUIRED_EVENT = "source_of_funds.required";

function penceToMajor(pence: number): string {
  return (pence / 100).toFixed(2);
}

function majorToPence(major: string): number {
  return Math.round(Number.parseFloat(major) * 100);
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "23505";
}

/**
 * Payment hot path: settlement gate evaluation and pending-case creation.
 * Used by the settlement compliance policy in every process that raises or
 * settles an invoice, so the API and the worker apply the same threshold.
 */
export class SourceOfFundsGateService implements ISourceOfFundsGate {
  constructor(
    private readonly repo: ISourceOfFundsRepository,
    private readonly config: SourceOfFundsConfig,
    private readonly transactionRunner: ITransactionRunner | null = null,
    private readonly events: ISourceOfFundsEventSink | null = null,
  ) {}

  private thresholdPence(): number {
    return Math.round(this.config.thresholdAmount * 100);
  }

  async requiresSourceOfFunds(input: SettlementComplianceInput): Promise<boolean> {
    const thresholdPence = this.thresholdPence();
    if (thresholdPence <= 0) return false;

    const linkedPence = await this.repo.sumActiveBuyerSettlementPence(
      input.buyerUserId,
      input.excludePaymentId,
    );
    const exposurePence = linkedPence + input.amountPence;
    if (exposurePence < thresholdPence) return false;

    const approved = await this.repo.findLatestApprovedForUser(input.buyerUserId);
    if (approved && this.isApprovalStillValid(approved, exposurePence)) {
      return false;
    }

    await this.ensurePendingCase(
      input.buyerUserId,
      exposurePence,
      linkedPence > 0 ? "linked_transactions" : "threshold",
    );
    return true;
  }

  async hasPendingCaseForUser(buyerUserId: string): Promise<boolean> {
    const pending = await this.repo.findPendingForUser(buyerUserId);
    return pending !== null;
  }

  private isApprovalStillValid(approved: SourceOfFundsCase, currentExposurePence: number): boolean {
    if (!approved.reviewedAt) return false;
    const ageMs = Date.now() - approved.reviewedAt.getTime();
    const maxAgeMs = this.config.approvalValidityDays * 24 * 60 * 60 * 1000;
    if (ageMs > maxAgeMs) return false;
    const approvedExposurePence = majorToPence(approved.exposureAmount);
    if (currentExposurePence >= approvedExposurePence + this.thresholdPence()) return false;
    return true;
  }

  private async ensurePendingCase(
    userId: string,
    exposurePence: number,
    trigger: SourceOfFundsTrigger,
  ): Promise<SourceOfFundsCase> {
    const run = async (conn?: Database): Promise<SourceOfFundsCase> => {
      const pending = await this.repo.findPendingForUser(userId, conn);
      if (pending) return pending;
      const latest = await this.repo.findLatestForUser(userId, conn);
      if (latest && latest.status === "rejected") return latest;

      let created: SourceOfFundsCase;
      try {
        created = await this.repo.create(
          {
            userId,
            trigger,
            thresholdAmount: this.config.thresholdAmount.toFixed(2),
            exposureAmount: penceToMajor(exposurePence),
            currency: this.config.currency,
          },
          conn,
        );
      } catch (err) {
        if (isUniqueViolation(err)) {
          const raced = await this.repo.findPendingForUser(userId, conn);
          if (raced) return raced;
        }
        throw err;
      }

      if (conn && this.events) {
        await this.events.withTx(conn).publish({
          aggregateType: "source_of_funds",
          aggregateId: created.id,
          eventType: SOURCE_OF_FUNDS_REQUIRED_EVENT,
          actorUserId: userId,
          payload: {
            sourceOfFundsId: created.id,
            userId: created.userId,
            trigger: created.trigger,
            thresholdAmount: created.thresholdAmount,
            exposureAmount: created.exposureAmount,
            currency: created.currency,
          },
        });
      }
      return created;
    };

    if (this.transactionRunner) return this.transactionRunner.runInTransaction((tx) => run(tx));
    return run();
  }
}
