export interface ISourceOfFundsSettlementReader {
  loadSettlementContext(userId: string): Promise<{ summary: string | null }>;
  getCaseStatus(sourceOfFundsId: string): Promise<string | null>;
}

export interface ISourceOfFundsBuyerReader {
  getBuyerContact(userId: string): Promise<{ email: string; firstName: string | null } | null>;
}

export interface ISourceOfFundsDocumentsTaskRepository {
  reopenResolvedReviewTask(sourceOfFundsId: string): Promise<void>;
}
