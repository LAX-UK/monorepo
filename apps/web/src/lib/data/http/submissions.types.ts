import type { ItemSubmissionStatus } from "@auction/types";

/** Admin submissions decision-queue tabs (`GET /submissions?queue=`). */
export type AdminSubmissionDecisionQueue = "awaiting" | "accepted" | "rejected";

export type GetMySubmissionsParams = {
  status?: ItemSubmissionStatus;
  q?: string;
  limit?: number;
  offset?: number;
};

export type GetAdminSubmissionsParams = {
  status?: ItemSubmissionStatus;
  /** Grouped statuses for staff queues. Prefer over `status` when both passed. */
  queue?: AdminSubmissionDecisionQueue;
  sellerId?: string;
  categoryId?: string;
  q?: string;
  qualityGaps?: boolean;
  assignedTo?: "me";
  sort?: "newest" | "oldest" | "sla";
  limit?: number;
  offset?: number;
};
