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
  /** Closes a withdrawal request as declined, keeping the staff reason on the task. */
  declineLotWithdrawal(input: {
    taskId: string;
    declinedByUserId: string;
    reason: string;
  }): Promise<void>;
}
