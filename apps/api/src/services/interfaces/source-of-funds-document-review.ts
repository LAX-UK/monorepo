import type {
  SourceOfFundsDocumentChecks,
  SourceOfFundsDocumentReviewRow,
} from "../../repositories/drizzle-source-of-funds-document-review.repository.js";

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
