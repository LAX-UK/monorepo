export interface IAdminReviewTaskRepository {
  forConnection(conn: import("@auction/db").Database): IAdminReviewTaskRepository;
  findPendingLotWithdrawal(lotId: string): Promise<{ id: string } | null>;
  createLotWithdrawalRequest(input: {
    lotId: string;
    requestedByUserId: string;
  }): Promise<{ id: string }>;
  resolveLotWithdrawal(input: {
    taskId: string;
    resolvedByUserId: string;
    resolutionNotes: string;
  }): Promise<void>;
}
