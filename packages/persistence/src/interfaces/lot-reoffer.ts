import type { Database } from "@auction/db";
import type {
  ReawardGuardCode,
  ReofferRecord,
  ReofferStatus,
  SellerConsentStatus,
} from "@auction/domain";

/** One offer of a defaulted lot to one bidder, as the application reads it. */
export type LotReofferView = {
  id: string;
  lotId: string;
  buyerDefaultId: string;
  sequence: number;
  offeredUserId: string;
  offeredLegalEntityId: string;
  sourceBidId: string;
  /** Whole pence: the bidder's own bid. */
  amountPence: number;
  status: ReofferStatus;
  sellerConsentId: string;
  offerSentAt: Date | null;
  offerEndsAt: Date | null;
  respondedAt: Date | null;
  /** When the lot was re-awarded to this bidder; set once. */
  reawardedAt: Date | null;
  declineReason: string | null;
  invoiceId: string | null;
  paymentId: string | null;
  createdBy: string | null;
  closedBy: string | null;
  closeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SellerConsentView = {
  id: string;
  subjectType: "lot_reoffer";
  subjectId: string;
  sellerLegalEntityId: string;
  lotId: string;
  termsSnapshot: SellerConsentTerms;
  status: SellerConsentStatus;
  channel: SellerConsentChannel | null;
  answeredByUserId: string | null;
  answeredAt: Date | null;
  note: string | null;
  requestedAt: Date;
  dueAt: Date | null;
  remindedAt: Date | null;
  preferredNext: SellerPreferredNext | null;
};

/** How an answer was recorded; `house_stock` when LAX owns the lot and nobody answers. */
export type SellerConsentChannel = "workspace" | "recorded_by_staff" | "house_stock";

export type SellerPreferredNext = "later_sale" | "return_to_me" | "talk_to_us";

/** What the seller was shown, kept as evidence. The reserve is never a gate. */
export type SellerConsentTerms = {
  amountPence: number;
  originalHammerPence: number;
  proceedsAtOfferPence: number;
  proceedsAtOriginalPence: number;
  reservePence: number | null;
};

export type CreateLotReofferInput = {
  lotId: string;
  buyerDefaultId: string;
  sequence: number;
  offeredUserId: string;
  offeredLegalEntityId: string;
  sourceBidId: string;
  amountPence: number;
  /** `awaiting_seller`, or `ready` when no consent is needed. */
  status: Extract<ReofferStatus, "awaiting_seller" | "ready">;
  sellerLegalEntityId: string;
  consent: {
    status: Extract<SellerConsentStatus, "requested" | "not_needed">;
    channel: Extract<SellerConsentChannel, "house_stock"> | null;
    terms: SellerConsentTerms;
    requestedAt: Date;
    dueAt: Date | null;
  };
  createdBy: string | null;
};

/** The offer is no longer in the state the caller read: someone else moved it first. */
export class LotReofferConflictError extends Error {
  constructor(message = "The offer changed. Reload and try again.") {
    super(message);
    this.name = "LotReofferConflictError";
  }
}

export type ReofferStatusChange = {
  id: string;
  /** The status the caller read; the write refuses if the offer has moved on. */
  from: ReofferStatus;
  to: ReofferStatus;
  offerSentAt?: Date;
  offerEndsAt?: Date;
  respondedAt?: Date;
  declineReason?: string | null;
  closedBy?: string | null;
  closeReason?: string | null;
};

export interface ILotReofferReader {
  findById(id: string): Promise<LotReofferView | null>;
  /** Every offer of one default, in the order they were made. */
  listForDefault(buyerDefaultId: string): Promise<LotReofferView[]>;
  /** The offer waiting on someone for this lot, if any (there is at most one). */
  findOpenForLot(lotId: string): Promise<LotReofferView | null>;
}

export interface ILotReofferRepository {
  /**
   * In the caller's transaction: the seller's request (or its `not_needed` record) and the offer
   * that points at it. Throws `LotReofferConflictError` when the lot already has an open offer or
   * the default already has this sequence.
   */
  create(tx: Database, input: CreateLotReofferInput): Promise<{ id: string; consentId: string }>;
  /** Moves an offer from the status the caller read. Throws `LotReofferConflictError` otherwise. */
  changeStatus(tx: Database, change: ReofferStatusChange): Promise<void>;
  /** Offers reduced to what the rules need (`offerSentAt` from `offer_sent_at`). */
  recordsForDefault(tx: Database, buyerDefaultId: string): Promise<ReofferRecord[]>;
}

export type SellerConsentAnswerWrite = {
  id: string;
  /** The status the caller read; the write refuses if the request has moved on. */
  from: SellerConsentStatus;
  to: Extract<SellerConsentStatus, "given" | "refused" | "lapsed">;
  /** `null` for a lapse: the clock answers, nobody else. */
  channel: Extract<SellerConsentChannel, "workspace" | "recorded_by_staff"> | null;
  answeredByUserId: string | null;
  answeredAt: Date;
  note: string | null;
  preferredNext: SellerPreferredNext | null;
};

export interface ISellerConsentRepository {
  findById(id: string): Promise<SellerConsentView | null>;
  findForReoffer(reofferId: string): Promise<SellerConsentView | null>;
  /** Records an answer from the status the caller read. Throws `LotReofferConflictError` otherwise. */
  answer(tx: Database, write: SellerConsentAnswerWrite): Promise<void>;
  /** Marks the one reminder as sent; `false` when it was already sent. */
  markReminded(id: string, remindedAt: Date): Promise<boolean>;
}

/** Why the lot was not re-awarded. */
export class LotReawardRefusedError extends Error {
  constructor(
    readonly code: ReawardGuardCode | "offer_not_found",
    message: string,
  ) {
    super(message);
    this.name = "LotReawardRefusedError";
  }
}

export type ReawardLotInput = {
  reofferId: string;
};

export type ReawardLotResult = {
  /** `already_reawarded` when this offer already re-awarded the lot: nothing was written. */
  outcome: "reawarded" | "already_reawarded";
  lotId: string;
  saleId: string | null;
  sellerLegalEntityId: string | null;
  reofferId: string;
  buyerDefaultId: string;
  sequence: number;
  newBuyerId: string;
  newBuyerLegalEntityId: string;
  previousBuyerId: string;
  amountPence: number;
  originalHammerPence: number;
  wonAt: Date;
};

export interface ILotReawardRepository {
  /**
   * In the caller's transaction, under a row lock on the lot: re-checks that the offer is
   * accepted and answers the lot's latest default, that its source bid is the bidder's own, that
   * no payment on the lot is paid or being paid and that no other offer of the default was
   * accepted, then makes the bidder the lot's winner at the offered amount, marks
   * their bid winning, resets fulfilment to a fresh awaiting-payment record and stamps the offer's
   * `reawardedAt`. Lock order: lot, then offer. The original hammer stays on the
   * buyer default. Throws `LotReawardRefusedError` when any check fails; writes nothing then.
   */
  reaward(tx: Database, input: ReawardLotInput): Promise<ReawardLotResult>;
}
