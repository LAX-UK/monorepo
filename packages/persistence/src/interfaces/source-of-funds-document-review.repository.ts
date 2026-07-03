import type { Database } from "@auction/db";

export type SourceOfFundsDocumentChecks = {
  matchesDeclaredSource?: boolean;
  coversExposure?: boolean;
  recentEnough?: boolean;
  legibleComplete?: boolean;
};

export type SourceOfFundsDocumentReviewRow = {
  documentId: string;
  sourceOfFundsId: string;
  reviewedByUserId: string;
  reviewedAt: Date;
  checks: SourceOfFundsDocumentChecks;
  note: string | null;
};

export interface ISourceOfFundsDocumentReviewRepository {
  upsertLatest(
    input: {
      documentId: string;
      sourceOfFundsId: string;
      reviewedByUserId: string;
      reviewedAt: Date;
      checks: SourceOfFundsDocumentChecks;
      note: string | null;
    },
    conn?: Database,
  ): Promise<SourceOfFundsDocumentReviewRow>;
  listForCase(sourceOfFundsId: string, conn?: Database): Promise<SourceOfFundsDocumentReviewRow[]>;
  deleteForDocument(documentId: string, conn?: Database): Promise<void>;
  deleteForDocuments(documentIds: readonly string[], conn?: Database): Promise<void>;
}
