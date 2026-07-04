import type { SourceOfFundsDocumentChecks, SourceOfFundsDocumentReviewRow } from "@auction/persistence/interfaces";

export type ReviewSourceOfFundsDocumentCommand = {
  caseId: string;
  documentId: string;
  staffUserId: string;
  checks: SourceOfFundsDocumentChecks;
  note: string | null;
};

export interface ISourceOfFundsDocumentReviewService {
  reviewDocument(
    command: ReviewSourceOfFundsDocumentCommand,
  ): Promise<SourceOfFundsDocumentReviewRow>;
}
