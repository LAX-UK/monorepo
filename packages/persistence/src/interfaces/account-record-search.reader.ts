import type { AccountSearchScopes, AccountSearchTerms } from "@auction/domain";
import type {
  ItemSubmissionStatus,
  LegalEntityMemberRole,
  LotStatus,
  PaymentStatus,
} from "@auction/types";

/**
 * Record search inside one account. Each group reads only the acting account's rows, narrowed by
 * the scope the domain decided for the member (`accountSearchScopes`), and returns one page in a
 * stable order. Readers never decide who may search; they apply the scope they are given.
 */
export type AccountSearchCriteria<S> = {
  legalEntityId: string;
  /** The searching member, for scopes narrowed to their own records. */
  userId: string;
  scope: S;
  terms: AccountSearchTerms;
  limit: number;
  offset: number;
};

/** A lot as search shows it: enough to name it and link to it, never a price. */
export type LotSearchHit = {
  lotId: string;
  title: string;
  artistName: string | null;
  lotNumber: number | null;
  saleId: string | null;
  saleTitle: string | null;
  lotStatus: LotStatus;
  endsAt: Date;
};

/** A consignment (a submission) with the lot made from it, once there is one. */
export type ConsignmentSearchHit = {
  submissionId: string;
  title: string;
  status: ItemSubmissionStatus;
  lot: Omit<LotSearchHit, "title" | "endsAt"> | null;
  updatedAt: Date;
};

export type InvoiceSearchHit = {
  paymentId: string;
  invoiceNumber: string;
  lotId: string;
  title: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
};

export type MemberSearchHit = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: LegalEntityMemberRole;
};

/** What each group returns. */
export type AccountSearchHits = {
  consignments: ConsignmentSearchHit;
  purchases: LotSearchHit;
  bids: LotSearchHit;
  works: LotSearchHit;
  invoices: InvoiceSearchHit;
  members: MemberSearchHit;
};

/** One reader per group, so a new group is a new entry and nothing else changes. */
export type IAccountRecordSearchReader = {
  [G in keyof AccountSearchHits]: (
    criteria: AccountSearchCriteria<NonNullable<AccountSearchScopes[G]>>,
  ) => Promise<AccountSearchHits[G][]>;
};
