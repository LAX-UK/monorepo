import type {
  FailedJobDetail,
  FailedJobDiscardReason,
  FailedJobFacetOption,
  FailedJobRetryAvailability,
  FailedJobSource,
  FailedJobSourceFamily,
  FailedJobState,
  FailedJobSummary,
  FailedJobView,
} from "@auction/types";
import type { ActorContext } from "../../../interfaces/queue-inspector.js";

/** What the person asking may do, source by source. Built once per request from their roles. */
export type FailedJobViewer = {
  read: ReadonlySet<FailedJobSource>;
  act: ReadonlySet<FailedJobSource>;
};

/** A list request as one source sees it: the shared filters, and the window of rows it returns. */
export type SourceListQuery = {
  view: FailedJobView;
  sort: "failed_desc" | "failed_asc";
  limit: number;
  offset: number;
  q?: string;
  queue?: string;
  fromDay?: string;
  toDay?: string;
  viewer: FailedJobViewer;
  actionsEnabled: boolean;
};

export type SourceListResult = {
  /** The viewer may read this source at all; false hides it from the Source filter. */
  readable: boolean;
  rows: FailedJobSummary[];
  /** Rows in the chosen view under the filters. */
  total: number;
  counts: Record<FailedJobView, number>;
  queues: FailedJobFacetOption[];
};

/**
 * One failed job or delivery that a decision can be taken on. The source builds it with the
 * store-specific operations bound, so the service applies the same rules (state, access, repeat
 * confirmation, audit) to every source without knowing where the record lives.
 */
export type ReviewTarget = {
  /** The id the screen uses, prefixed by source. */
  id: string;
  source: FailedJobSource;
  state: FailedJobState;
  /** Whether a retry is offered now, by state and kind; the operator's switch is checked here too. */
  retry: FailedJobRetryAvailability;
  /** A retry may repeat something a person sees. */
  mayRepeat: boolean;
  /** The id the audit trail records the decision under. */
  auditId: string;
  /** Facts the audit entry carries beside the decision. */
  auditFacts: Record<string, unknown>;
  /** Runs the job again; throws an Error whose message is a code the screen can word. */
  retryNow(actor: ActorContext): Promise<void>;
  /** Sets the job aside; false when it was no longer waiting for review. */
  discard(input: {
    byUserId: string;
    reason: FailedJobDiscardReason;
    note: string | null;
  }): Promise<boolean>;
  /** Puts a discarded job back in review; false when it was not discarded. */
  restore(): Promise<boolean>;
};

/**
 * A place failures are read from. The service composes sources; each one lists its own rows,
 * opens one, and finds the targets of a decision. Adding a source is a new class and one line
 * where the service is built.
 */
export interface FailedJobSourceAdapter {
  readonly family: FailedJobSourceFamily;
  /** Whether this source holds the job with this prefixed id. */
  owns(id: string): boolean;
  /** Whether a "Job type" filter value belongs to this source. */
  ownsQueue(queue: string): boolean;
  list(query: SourceListQuery): Promise<SourceListResult>;
  detail(
    id: string,
    viewer: FailedJobViewer,
    actionsEnabled: boolean,
    history: (auditId: string) => Promise<FailedJobDetail["history"]>,
  ): Promise<FailedJobDetail | null>;
  /** Targets for the ids this source owns and can find, with access and the switch applied. */
  find(ids: readonly string[], actionsEnabled: boolean): Promise<ReviewTarget[]>;
}
