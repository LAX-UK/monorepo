import type { Database } from "@auction/db";
import type {
  ISourceOfFundsGate,
  SettlementComplianceInput,
} from "../aml/settlement-compliance.policy.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type {
  ISourceOfFundsRepository,
  SourceOfFundsCase,
  SourceOfFundsTrigger,
} from "./source-of-funds.types.js";

export const SOURCE_OF_FUNDS_REQUIRED_EVENT = "source_of_funds.required";
export const SOURCE_OF_FUNDS_REVIEWED_EVENT = "source_of_funds.reviewed";

export type SourceOfFundsConfig = {
  /** SoF threshold in GBP major units (no FX; platform is GBP-only). */
  thresholdAmount: number;
  currency: string;
  /** Days an approved SoF case clears future settlements before re-validation. */
  approvalValidityDays: number;
};

export type SourceOfFundsTriageCommand = {
  caseId: string;
  analystUserId: string;
  recommendation: "approve" | "reject";
  notes: string | null;
};

export type SourceOfFundsDecideCommand = {
  caseId: string;
  reviewerUserId: string;
  decision: "approve" | "reject";
  notes: string | null;
};

function penceToMajor(pence: number): string {
  return (pence / 100).toFixed(2);
}

function majorToPence(major: string): number {
  return Math.round(Number.parseFloat(major) * 100);
}

/**
 * Source-of-Funds service (CDD Section 6). Implements the settlement gate: a
 * buyer crossing the SoF threshold — by single transaction or aggregated linked
 * transactions — must have an `approved` SoF case before settlement proceeds.
 *
 * Implements `ISourceOfFundsGate` so the settlement compliance policy depends on
 * an abstraction, not this concretion (Dependency Inversion).
 */
export class SourceOfFundsService implements ISourceOfFundsGate {
  constructor(
    private readonly repo: ISourceOfFundsRepository,
    private readonly config: SourceOfFundsConfig,
    private readonly db: Database | null = null,
    private readonly events: DomainEventPublisher | null = null,
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
    // Below the threshold (single + aggregated linked transactions): no SoF.
    if (exposurePence < thresholdPence) return false;

    // Event-driven validity: a prior approval clears the buyer only until a
    // material risk signal (much larger exposure) or the validity window lapses.
    // New screening hits are handled separately by the AML hold gate, which the
    // settlement policy evaluates before this gate.
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

  /**
   * An approved SoF case clears future settlements until either the validity
   * window lapses or the buyer's aggregated exposure grows by another full
   * threshold beyond what was approved (a material increase warranting re-CDD).
   */
  private isApprovalStillValid(approved: SourceOfFundsCase, currentExposurePence: number): boolean {
    if (!approved.reviewedAt) return false;
    const ageMs = Date.now() - approved.reviewedAt.getTime();
    const maxAgeMs = this.config.approvalValidityDays * 24 * 60 * 60 * 1000;
    if (ageMs > maxAgeMs) return false;
    const approvedExposurePence = majorToPence(approved.exposureAmount);
    if (currentExposurePence >= approvedExposurePence + this.thresholdPence()) return false;
    return true;
  }

  /** Pending SoF cases awaiting MLRO/finance review. */
  async listPending(limit = 50): Promise<SourceOfFundsCase[]> {
    return this.listByStatus("pending", limit);
  }

  async countPending(): Promise<number> {
    return this.repo.countByStatus("pending");
  }

  async listByStatus(status: "pending" | "rejected", limit = 50): Promise<SourceOfFundsCase[]> {
    return this.repo.listByStatus(status, limit);
  }

  /**
   * First-line analyst triage (maker): advisory recommendation only. Does not
   * change the case status; the binding decision is made by a different
   * MLRO/finance user via `decide` (maker-checker / four-eyes).
   */
  async triage(command: SourceOfFundsTriageCommand): Promise<SourceOfFundsCase> {
    const run = async (conn?: Database): Promise<SourceOfFundsCase> => {
      const existing = await this.repo.findById(command.caseId, conn);
      if (!existing) throw new Error("source_of_funds_not_found");
      if (existing.userId === command.analystUserId) {
        throw new Error("source_of_funds_triage_self_forbidden");
      }
      if (existing.status !== "pending") {
        throw new Error("source_of_funds_not_pending");
      }
      if (existing.triageRecommendation) {
        throw new Error("source_of_funds_triage_already_set");
      }
      const recommendation =
        command.recommendation === "approve" ? "recommend_approve" : "recommend_reject";
      const updated = await this.repo.setTriage(
        {
          id: command.caseId,
          recommendation,
          triagedByUserId: command.analystUserId,
          triageNotes: command.notes,
        },
        conn,
      );
      if (!updated) throw new Error("source_of_funds_triage_already_set");
      return updated;
    };

    if (this.db) return this.db.transaction((tx) => run(tx));
    return run();
  }

  /**
   * MLRO/finance binding disposition (checker). Enforces maker-checker: the
   * decider must differ from the subject and from the analyst who triaged, and a
   * triage recommendation must already exist.
   */
  async decide(command: SourceOfFundsDecideCommand): Promise<SourceOfFundsCase> {
    const run = async (conn?: Database): Promise<SourceOfFundsCase> => {
      const existing = await this.repo.findById(command.caseId, conn);
      if (!existing) throw new Error("source_of_funds_not_found");
      if (existing.userId === command.reviewerUserId) {
        throw new Error("source_of_funds_review_self_forbidden");
      }
      if (existing.status !== "pending") {
        throw new Error("source_of_funds_not_pending");
      }
      if (!existing.triagedByUserId || !existing.triageRecommendation) {
        throw new Error("source_of_funds_triage_required");
      }
      if (existing.triagedByUserId === command.reviewerUserId) {
        throw new Error("source_of_funds_review_same_as_triager");
      }
      const status = command.decision === "approve" ? "approved" : "rejected";
      const updated = await this.repo.setReview(
        {
          id: command.caseId,
          status,
          reviewedByUserId: command.reviewerUserId,
          reviewNotes: command.notes,
        },
        conn,
      );
      if (!updated) throw new Error("source_of_funds_not_pending");

      if (conn && this.events) {
        await this.events.publish(conn, {
          aggregateType: "source_of_funds",
          aggregateId: updated.id,
          eventType: SOURCE_OF_FUNDS_REVIEWED_EVENT,
          actorUserId: command.reviewerUserId,
          payload: {
            sourceOfFundsId: updated.id,
            userId: updated.userId,
            status: updated.status,
            trigger: updated.trigger,
          },
        });
      }
      return updated;
    };

    if (this.db) return this.db.transaction((tx) => run(tx));
    return run();
  }

  /**
   * Deliberate compliance action to re-open a rejected SoF case (e.g. buyer
   * supplied new evidence). Resets maker-checker fields and re-publishes
   * `source_of_funds.required` for operational visibility.
   */
  async reopenRejected(command: {
    caseId: string;
    actorUserId: string;
  }): Promise<SourceOfFundsCase> {
    const run = async (conn?: Database): Promise<SourceOfFundsCase> => {
      const existing = await this.repo.findById(command.caseId, conn);
      if (!existing) throw new Error("source_of_funds_not_found");
      if (existing.status !== "rejected") {
        throw new Error("source_of_funds_not_rejected");
      }
      const updated = await this.repo.reopenRejected(command.caseId, conn);
      if (!updated) throw new Error("source_of_funds_reopen_failed");

      if (conn && this.events) {
        await this.events.publish(conn, {
          aggregateType: "source_of_funds",
          aggregateId: updated.id,
          eventType: SOURCE_OF_FUNDS_REQUIRED_EVENT,
          actorUserId: command.actorUserId,
          payload: {
            sourceOfFundsId: updated.id,
            userId: updated.userId,
            trigger: updated.trigger,
            thresholdAmount: updated.thresholdAmount,
            exposureAmount: updated.exposureAmount,
            currency: updated.currency,
            reopened: true,
          },
        });
      }
      return updated;
    };

    if (this.db) return this.db.transaction((tx) => run(tx));
    return run();
  }

  private async ensurePendingCase(
    userId: string,
    exposurePence: number,
    trigger: SourceOfFundsTrigger,
  ): Promise<SourceOfFundsCase> {
    const run = async (conn?: Database): Promise<SourceOfFundsCase> => {
      const latest = await this.repo.findLatestForUser(userId, conn);
      // A pending case is already open; do not duplicate review work.
      if (latest && latest.status === "pending") return latest;
      // A rejected case keeps blocking settlement; do NOT reopen automatically on
      // checkout retries (avoids unbounded case/task churn). Re-opening is a
      // deliberate compliance action.
      if (latest && latest.status === "rejected") return latest;

      const created = await this.repo.create(
        {
          userId,
          trigger,
          thresholdAmount: this.config.thresholdAmount.toFixed(2),
          exposureAmount: penceToMajor(exposurePence),
          currency: this.config.currency,
        },
        conn,
      );

      if (conn && this.events) {
        await this.events.publish(conn, {
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

    if (this.db) return this.db.transaction((tx) => run(tx));
    return run();
  }
}
