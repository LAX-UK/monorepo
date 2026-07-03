import type { SettlementComplianceInput } from "../aml/settlement-compliance.policy.js";
import type {
  SourceOfFundsCase,
  SourceOfFundsStatus,
} from "../source-of-funds/source-of-funds.types.js";

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

/** Payment hot path: settlement gate evaluation with optional case creation side effects. */
export interface ISourceOfFundsGateService {
  requiresSourceOfFunds(input: SettlementComplianceInput): Promise<boolean>;
  hasPendingCaseForUser(buyerUserId: string): Promise<boolean>;
}

/** Admin triage: maker-checker review workflow and case listing. */
export interface ISourceOfFundsReviewService {
  listPending(limit?: number): Promise<SourceOfFundsCase[]>;
  countPending(): Promise<number>;
  countByStatus(status: SourceOfFundsStatus): Promise<number>;
  listByStatus(
    status: SourceOfFundsStatus,
    limit?: number,
    offset?: number,
  ): Promise<SourceOfFundsCase[]>;
  triage(command: SourceOfFundsTriageCommand): Promise<SourceOfFundsCase>;
  decide(command: SourceOfFundsDecideCommand): Promise<SourceOfFundsCase>;
  reopenRejected(command: { caseId: string; actorUserId: string }): Promise<SourceOfFundsCase>;
}

export interface ISourceOfFundsService
  extends ISourceOfFundsGateService,
    ISourceOfFundsReviewService {}
