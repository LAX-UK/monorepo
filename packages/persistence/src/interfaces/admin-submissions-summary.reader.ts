export type AdminSubmissionsQueueCounts = {
  awaiting: number;
  accepted: number;
  rejected: number;
};

export type AdminSubmissionsListSummary = {
  awaitingReview: number;
  assignedToMe: number;
  overSla: number;
  rejectedToday: number;
  qualityGaps: number;
  reviewedToday: number;
  /** Mean queue age (days since created) for awaiting submissions. */
  avgQueueAgeDays: number | null;
  queueCounts: AdminSubmissionsQueueCounts;
};

export interface IAdminSubmissionsSummaryReader {
  getSummaryForStaff(userId: string): Promise<AdminSubmissionsListSummary>;
}
