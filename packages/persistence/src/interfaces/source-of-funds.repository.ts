import type { Database } from "@auction/db";

export type SourceOfFundsStatus = "pending" | "approved" | "rejected";

export type SourceOfFundsTrigger =
  | "threshold"
  | "linked_transactions"
  | "risk_indicator"
  | "manual";

/** First-line analyst recommendation (advisory) in the maker-checker flow. */
export type SourceOfFundsTriageRecommendation = "recommend_approve" | "recommend_reject";

export type SourceOfFundsCase = {
  id: string;
  userId: string;
  status: SourceOfFundsStatus;
  trigger: SourceOfFundsTrigger;
  thresholdAmount: string;
  exposureAmount: string;
  currency: string;
  declaredSource: string | null;
  evidence: string[];
  documentsRequestedAt: Date | null;
  documentsRequestedByUserId: string | null;
  documentRequestNote: string | null;
  requestedDocumentTypes: string[];
  documentsSubmittedAt: Date | null;
  triageRecommendation: SourceOfFundsTriageRecommendation | null;
  triagedByUserId: string | null;
  triagedAt: Date | null;
  triageNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateSourceOfFundsCaseInput = {
  userId: string;
  trigger: SourceOfFundsTrigger;
  thresholdAmount: string;
  exposureAmount: string;
  currency: string;
};

export type SourceOfFundsTriageInput = {
  id: string;
  recommendation: SourceOfFundsTriageRecommendation;
  triagedByUserId: string;
  triageNotes: string | null;
};

export type SourceOfFundsReviewInput = {
  id: string;
  status: Extract<SourceOfFundsStatus, "approved" | "rejected">;
  reviewedByUserId: string;
  reviewNotes: string | null;
};

export interface ISourceOfFundsRepository {
  findLatestForUser(userId: string, conn?: Database): Promise<SourceOfFundsCase | null>;
  findById(id: string, conn?: Database): Promise<SourceOfFundsCase | null>;
  findLatestApprovedForUser(userId: string, conn?: Database): Promise<SourceOfFundsCase | null>;
  /**
   * The buyer's oldest still-`pending` case, if any. Distinct from
   * `findLatestForUser`: a pending review can exist behind a newer terminal
   * (approved/rejected) case, and must be reused rather than duplicated.
   */
  findPendingForUser(userId: string, conn?: Database): Promise<SourceOfFundsCase | null>;
  listByStatus(
    status: SourceOfFundsStatus,
    limit: number,
    offset?: number,
    conn?: Database,
  ): Promise<SourceOfFundsCase[]>;
  countByStatus(status: SourceOfFundsStatus, conn?: Database): Promise<number>;
  create(input: CreateSourceOfFundsCaseInput, conn?: Database): Promise<SourceOfFundsCase>;
  setTriage(input: SourceOfFundsTriageInput, conn?: Database): Promise<SourceOfFundsCase | null>;
  setReview(input: SourceOfFundsReviewInput, conn?: Database): Promise<SourceOfFundsCase | null>;
  /** Re-open a rejected case for a fresh maker-checker cycle (clears triage/decision). */
  reopenRejected(id: string, conn?: Database): Promise<SourceOfFundsCase | null>;
  setDocumentRequest(
    input: {
      id: string;
      requestedByUserId: string;
      documentTypes: string[];
      note: string | null;
    },
    conn?: Database,
  ): Promise<SourceOfFundsCase | null>;
  setDocumentsSubmitted(id: string, conn?: Database): Promise<SourceOfFundsCase | null>;
  resetDocumentCycle(id: string, conn?: Database): Promise<void>;
  /**
   * Aggregate the buyer's in-flight + settled settlement value (pence) across
   * open payment records, used for linked-transaction (structuring) detection.
   */
  sumActiveBuyerSettlementPence(
    userId: string,
    excludePaymentId?: string,
    conn?: Database,
  ): Promise<number>;
  listForUser(userId: string, limit: number, conn?: Database): Promise<SourceOfFundsCase[]>;
  countPendingByUserIds(userIds: readonly string[], conn?: Database): Promise<Map<string, number>>;
}
