import type {
  EndingAuthorisation,
  ExpiredInvitation,
  HomeSubject,
  PendingAccessRequest,
  PurchaseNextStepFacts,
  PurchaseNextStepTimes,
  ReofferRequestSubject,
  UnreadReply,
} from "@auction/domain";
import type { SubmissionSenderFilter } from "./item-submission.repository.js";

/**
 * The facts behind "Needs you" for one account, one bounded read per fact. Each read is already
 * narrowed by what it is given (a member's own bids or wins, a consignor's own submissions);
 * what counts as a task, and for whom, is the domain's table (`needs-you.ts`).
 */
export interface INeedsYouFactsReader {
  /** Open lots the account has bid on (`bidderId`: one member's bids) and is not leading. */
  outbidLots(input: {
    legalEntityId: string;
    bidderId: string | null;
    now: Date;
    limit: number;
  }): Promise<Array<HomeSubject & { endsAt: Date; outbidAt: Date | null }>>;

  /** Won lots that are not finished: unpaid, or paid and not yet delivered or collected. */
  openPurchases(input: {
    legalEntityId: string;
    winnerId: string | null;
    limit: number;
  }): Promise<Array<HomeSubject & PurchaseNextStepFacts & PurchaseNextStepTimes>>;

  /** Open consignments whose specialist's terms are complete and not accepted. */
  agreementsToAccept(input: {
    legalEntityId: string;
    visibleTo: SubmissionSenderFilter | undefined;
    limit: number;
  }): Promise<Array<HomeSubject & { proposedAt: Date | null }>>;

  /**
   * Requests to re-offer a lot to the next bidder that wait for this seller account's answer and
   * can still be answered at `now`: a request past its deadline is closed (the worker lapses it).
   */
  reofferRequests(input: {
    legalEntityId: string;
    now: Date;
    limit: number;
  }): Promise<Array<ReofferRequestSubject & { requestedAt: Date | null }>>;

  /** Submissions sent back with changes requested. */
  changesRequested(input: {
    legalEntityId: string;
    visibleTo: SubmissionSenderFilter | undefined;
    limit: number;
  }): Promise<Array<HomeSubject & { note: string | null; requestedAt: Date | null }>>;

  /**
   * Invitations to the account that lapsed since `since` and were not followed by a newer
   * invitation to the same address or by the person joining.
   */
  expiredInvitations(input: {
    legalEntityId: string;
    since: Date;
    now: Date;
  }): Promise<ExpiredInvitation[]>;

  /** Active buyer-agent authorisations ending between `now` and `until` (`userId`: one agent's). */
  endingAuthorisations(input: {
    legalEntityId: string;
    userId: string | null;
    now: Date;
    until: Date;
  }): Promise<EndingAuthorisation[]>;

  /**
   * Consignments with a specialist's message nobody who answers has read, newest first, each
   * naming the author of the newest unread one.
   */
  unreadReplies(input: {
    legalEntityId: string;
    visibleTo: SubmissionSenderFilter | undefined;
    limit: number;
  }): Promise<UnreadReply[]>;

  /** "Ask for access" requests still waiting for a decision, oldest first. */
  pendingAccessRequests(input: {
    legalEntityId: string;
    limit: number;
  }): Promise<PendingAccessRequest[]>;

  /** The member's own checks: identity, and whether and when source of funds documents were asked for. */
  viewerChecks(userId: string): Promise<{
    identity: "verified" | "checking" | "required";
    sourceOfFundsRequested: boolean;
    /** When LAX asked for the documents; `null` when none are being asked for. */
    sourceOfFundsRequestedAt: Date | null;
  }>;
}
