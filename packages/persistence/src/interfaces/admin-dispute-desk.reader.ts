import type {
  DisputeDeskCase,
  DisputeDeskCaseSummary,
  DisputeDeskCounts,
  DisputeDeskView,
} from "@auction/types";

export type DisputeDeskListInput = {
  view: DisputeDeskView;
  /** Matches the dispute ID, the lot, the buyer or the seller. */
  q?: string;
  reason?: string;
  limit: number;
  offset: number;
};

/** A case as the page reads it; the timeline is built from these facts by the caller. */
export type DisputeDeskCaseRecord = Omit<DisputeDeskCase, "timeline">;

/** Read side of the Disputes screen. */
export interface IAdminDisputeDeskReader {
  /** One page of cases, soonest respond-by first, and how many cases each view holds. */
  listPage(input: DisputeDeskListInput): Promise<{
    rows: DisputeDeskCaseSummary[];
    hasNextPage: boolean;
    counts: DisputeDeskCounts;
  }>;
  findCase(caseId: string): Promise<DisputeDeskCaseRecord | null>;
}
