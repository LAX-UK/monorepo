export type SourceOfFundsDocumentReviewUpsert = {
  documentId: string;
  sourceOfFundsId: string;
  reviewedByUserId: string;
  reviewedAt: Date;
  checks: {
    matchesDeclaredSource: boolean;
    coversExposure: boolean;
    recentEnough: boolean;
    legibleComplete: boolean;
  };
  note: string | null;
};

export interface ISourceOfFundsDocumentReviewRepository {
  upsertReview(input: SourceOfFundsDocumentReviewUpsert): Promise<void>;
}

export interface ISourceOfFundsReviewResolutionRepository {
  resolveIfTerminal(
    sourceOfFundsId: string,
    actorUserId: string | null,
    log: import("pino").Logger,
  ): Promise<void>;
}
