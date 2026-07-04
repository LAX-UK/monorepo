export type SourceOfFundsTerminalCase = {
  id: string;
  reviewedAt: Date | null;
};

export type SourceOfFundsDocumentToPurge = {
  id: string;
  uploadObjectId: string;
  key: string;
};

export interface ISourceOfFundsDocumentPurgeRepository {
  findTerminalCasesPastRetention(cutoff: Date, limit: number): Promise<SourceOfFundsTerminalCase[]>;
  findDocumentsToPurge(caseIds: string[], limit: number): Promise<SourceOfFundsDocumentToPurge[]>;
  anonymizeDocument(docId: string, now: Date): Promise<void>;
  deleteDocumentReviews(docId: string): Promise<void>;
}
