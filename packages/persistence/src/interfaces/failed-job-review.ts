/** The stored view of a job that ran out of attempts, as the review screen reads it. */
export type FailedJobRecord = {
  id: string;
  originalQueue: string;
  originalJobId: string | null;
  originalJobName: string | null;
  errorMessage: string | null;
  attempts: number;
  firstFailedAt: Date;
  failedAt: Date;
  replayedAt: Date | null;
  replayedBy: string | null;
  discardedAt: Date | null;
  discardedBy: string | null;
  discardReason: string | null;
  discardNote: string | null;
};

/** A record with the stored payload, for the one job page. Never returned by the list. */
export type FailedJobRecordWithPayload = FailedJobRecord & { payloadJson: string | null };

export type FailedJobReviewView = "needs_review" | "retried" | "discarded";

export type FailedJobFilter = {
  q?: string;
  queue?: string;
  /** Inclusive London calendar days, `YYYY-MM-DD`, applied to the last failure. */
  fromDay?: string;
  toDay?: string;
};

export type FailedJobSearch = FailedJobFilter & {
  view: FailedJobReviewView;
  sort: "failed_desc" | "failed_asc";
  limit: number;
  offset: number;
};

export type FailedJobSearchResult = {
  rows: FailedJobRecord[];
  total: number;
  /** Rows in each view under the other filters, for the view tabs. */
  counts: Record<FailedJobReviewView, number>;
  /** Rows per queue in the chosen view, under the other filters. */
  queues: { queue: string; count: number }[];
};

/** Reads failed jobs for review. */
export interface IFailedJobReviewReader {
  search(input: FailedJobSearch): Promise<FailedJobSearchResult>;
  findForReview(id: string): Promise<FailedJobRecordWithPayload | null>;
  findManyForReview(ids: readonly string[]): Promise<FailedJobRecord[]>;
}

/** Records the decision to set a failed job aside, or to take that back. */
export interface IFailedJobDisposition {
  /** Discards jobs still waiting for review; returns the ids that changed. */
  discard(input: {
    ids: readonly string[];
    byUserId: string;
    reason: string;
    note: string | null;
  }): Promise<string[]>;
  /** Puts discarded jobs back in review; returns the ids that changed. */
  restore(ids: readonly string[]): Promise<string[]>;
}
