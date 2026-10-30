import type {
  AccountSearchScopes,
  AccountSearchTerms,
  BidOutcome,
  PurchaseInvoiceStatus,
} from "@auction/domain";
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
  /** For states that depend on time (a payment overdue). */
  now: Date;
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
  /** What the seller quotes on the phone ("C-1042"). */
  reference: string;
  title: string;
  status: ItemSubmissionStatus;
  lot: Omit<LotSearchHit, "title" | "endsAt"> | null;
  updatedAt: Date;
};

/** A won lot with what was paid and where the payment stands. */
export type PurchaseSearchHit = LotSearchHit & {
  /** The hammer price, decimal in `currency`. */
  hammerPrice: string;
  currency: string;
  /** Where its invoice stands (`purchaseInvoiceState`): due, overdue, paid and so on. */
  paymentState: PurchaseInvoiceStatus;
};

/** A lot bid on, with the highest the bidders in scope offered and how it stands for them. */
export type BidSearchHit = LotSearchHit & {
  /** The highest bid or maximum bid in scope, decimal in `currency`. */
  maximum: string | null;
  currency: string;
  outcome: BidOutcome | null;
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
  purchases: PurchaseSearchHit;
  bids: BidSearchHit;
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
