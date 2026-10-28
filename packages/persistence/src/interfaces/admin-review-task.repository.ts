export type LotWithdrawalTaskSnapshot = {
  id: string;
  status: "pending" | "in_progress" | "resolved" | "rejected";
  createdAt: Date;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
};

export interface IAdminReviewTaskRepository {
  forConnection(conn: import("@auction/db").Database): IAdminReviewTaskRepository;
  findPendingLotWithdrawal(lotId: string): Promise<{ id: string } | null>;
  /** The most recent seller withdrawal request for a lot, in any status. */
  findLatestLotWithdrawal(lotId: string): Promise<LotWithdrawalTaskSnapshot | null>;
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
