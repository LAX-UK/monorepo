export type AmlScreeningReviewPayload = {
  screeningId: string;
  userId: string | null;
  providerSessionId: string | null;
  outcome: string | null;
  matchStatus: string | null;
  categories: string | null;
  reasons: string | null;
};

export type SourceOfFundsReviewPayload = {
  sourceOfFundsId: string;
  userId: string | null;
  trigger: string | null;
  thresholdAmount: string | null;
  exposureAmount: string | null;
  currency: string | null;
};

export interface IAdminReviewTaskProjectorRepository {
  findAmlScreeningReview(screeningId: string): Promise<{ id: string } | null>;
  createAmlScreeningReview(payload: AmlScreeningReviewPayload): Promise<void>;
  findSourceOfFundsReview(sourceOfFundsId: string): Promise<{ id: string; status: string } | null>;
  reactivateSourceOfFundsReview(taskId: string): Promise<void>;
  createSourceOfFundsReview(payload: SourceOfFundsReviewPayload): Promise<void>;
}
