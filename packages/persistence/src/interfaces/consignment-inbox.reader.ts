import type {
  ConsignmentInboxSort,
  ConsignmentInboxView,
  ConsignmentMessageSide,
} from "@auction/domain";
import type { StaffPersonRecord } from "./consignment-message.repository.js";

/** What the inbox list, its counts and the bulk actions by filter all narrow by. */
export type ConsignmentInboxQueryFilter = {
  view: ConsignmentInboxView;
  /** The person looking: "mine" is their threads. */
  viewerUserId: string;
  /** Reference, title, account, people names or words in a message. */
  q?: string | undefined;
  /** Effective assignee user ids, or `unassigned`. */
  specialist?: readonly string[] | undefined;
  /** Sale ids, or `none`. */
  sale?: readonly string[] | undefined;
  /** Legal entity ids, or `private` for individual accounts. */
  organisation?: readonly string[] | undefined;
};

export type ConsignmentInboxRowRecord = {
  submissionId: string;
  title: string;
  referenceNumber: number;
  /** The first photo as stored; the caller turns it into a link. */
  image: string | null;
  sale: { id: string; name: string } | null;
  account: { id: string; name: string; kind: "individual" | "organisation" } | null;
  /** The client member who wrote most recently, else the member who sent the work. */
  clientPersonName: string | null;
  closedAt: Date | null;
  awaitingSince: Date | null;
  lastMessage: {
    side: ConsignmentMessageSide;
    authorName: string | null;
    body: string;
    hasAttachment: boolean;
    at: Date;
  };
  lastMessageSide: ConsignmentMessageSide;
  unreadFromClient: number;
  specialist: StaffPersonRecord | null;
  covering: StaffPersonRecord | null;
  /** When that cover ends; null runs until ended. */
  coveringUntil: Date | null;
};

export type ConsignmentInboxFacetRecord = { id: string; label: string; count: number };

export type ConsignmentInboxFacetsRecord = {
  specialist: ConsignmentInboxFacetRecord[];
  sale: ConsignmentInboxFacetRecord[];
  organisation: ConsignmentInboxFacetRecord[];
};

export type ConsignmentInboxSummaryRecord = {
  unanswered: number;
  /** When each open thread waiting on the viewer began to wait; the caller measures the clock. */
  mineWaitingSince: Date[];
  unassignedWaiting: number;
  unassignedOldestWaitingSince: Date | null;
  unassignedOldestAccountName: string | null;
};

/**
 * Reads across threads for the Bid admin inbox: the list with its counts, and the numbers behind
 * the tabs, the sidebar and the Dashboard. The cap on rows and queries per call is part of the
 * contract: a page costs a few queries, never one per row.
 */
export interface IConsignmentInboxReader {
  list(input: {
    filter: ConsignmentInboxQueryFilter;
    sort: ConsignmentInboxSort;
    limit: number;
    offset: number;
  }): Promise<{ rows: ConsignmentInboxRowRecord[]; total: number }>;
  /** Counts for each filter's checklist, under the view and search but not that filter. */
  facets(filter: ConsignmentInboxQueryFilter): Promise<ConsignmentInboxFacetsRecord>;
  summary(viewerUserId: string): Promise<ConsignmentInboxSummaryRecord>;
  /** Consignment ids of the threads a filter matches, newest activity first, up to `limit`. */
  findSubmissionIds(filter: ConsignmentInboxQueryFilter, limit: number): Promise<string[]>;
  /** Open threads per person (by effective assignee), for the assign menu. */
  openThreadCounts(userIds: readonly string[]): Promise<Map<string, number>>;
}
