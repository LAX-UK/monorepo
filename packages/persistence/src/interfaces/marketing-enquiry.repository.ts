import type { Database } from "@auction/db";
import type {
  EnquiryBudgetBand,
  EnquiryCloseReason,
  EnquiryContactPreference,
  EnquiryIntent,
  EnquiryRoutingRule,
  EnquiryStatus,
  EnquiryTiming,
  EnquiryView,
} from "@auction/domain";
import type { UploadOwner } from "./upload-persistence.repository.js";

export type MarketingEnquiryStatus = EnquiryStatus;

/** An enquiry as staff read it. */
export type MarketingEnquiryRecord = {
  id: string;
  /** What the sender quotes: E-1001 upwards. */
  reference: string;
  intent: EnquiryIntent;
  topic: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  sourcePage: string | null;
  status: MarketingEnquiryStatus;
  closeReason: EnquiryCloseReason | null;
  departmentSlug: string | null;
  assignedToUserId: string | null;
  userId: string | null;
  legalEntityId: string | null;
  marketingOptIn: boolean;
  version: number;
  createdAt: Date;
  /** When the enquiry was closed. */
  handledAt: Date | null;
  handledByUserId: string | null;
};

/** The answers a private sale enquiry carries beyond the generic enquiry. */
export type PrivateSaleEnquiryDetail = {
  artist: string | null;
  title: string | null;
  medium: string | null;
  size: string | null;
  locationTown: string | null;
  locationCountry: string | null;
  priceInMindMinor: number | null;
  lookingFor: string | null;
  budgetBand: EnquiryBudgetBand | null;
  timing: EnquiryTiming | null;
  contactPreference: EnquiryContactPreference;
};

export type EnquiryAttachmentRecord = {
  id: string;
  uploadObjectId: string;
  kind: "image" | "document";
  position: number;
};

export type MarketingEnquiryDetailRecord = MarketingEnquiryRecord & {
  privateSale: PrivateSaleEnquiryDetail | null;
  attachments: EnquiryAttachmentRecord[];
};

export type NewMarketingEnquiry = {
  intent: EnquiryIntent;
  topic: string;
  name: string;
  email: string;
  phone?: string | undefined;
  message: string;
  sourcePage?: string | undefined;
  departmentSlug?: string | undefined;
  assignedToUserId?: string | undefined;
  userId?: string | undefined;
  legalEntityId?: string | undefined;
  marketingOptIn: boolean;
  privateSale?: PrivateSaleEnquiryDetail | undefined;
};

/** The columns of one change to an enquiry; the version it is made against is separate. */
export type MarketingEnquiryChange = {
  status?: EnquiryStatus;
  closeReason?: EnquiryCloseReason | null;
  assignedToUserId?: string | null;
  /** Set with a close; cleared when a closed enquiry is reopened. */
  closed?: { at: Date; byUserId: string } | null;
};

/** What the viewer may see, resolved from their capabilities. */
export type EnquiryListScope = {
  viewerUserId: string;
  readsGeneral: boolean;
  readsPrivateSale: boolean;
};

export type EnquiryListFilter = {
  view: EnquiryView;
  scope: EnquiryListScope;
  intent?: EnquiryIntent | undefined;
  departmentSlug?: string | undefined;
  status?: EnquiryStatus | undefined;
  /** A user id, or `unassigned`. */
  assignee?: string | undefined;
  /** Continue after this enquiry, in the view's order. */
  afterId?: string | null | undefined;
  limit: number;
};

/** The files an enquiry arrived with, as the sender left them. */
export type ClaimedEnquiryFiles = { images: number; documents: number };

/** Moves a sender's uploaded files onto the enquiry they were sent with. */
export interface IEnquiryAttachmentRepository {
  /**
   * Attaches the listed uploads to the enquiry inside the caller's transaction. Only files the
   * owner uploaded for an enquiry and that passed their checks are attached, in the order given,
   * up to the limit for each kind; any other id is left out without an error.
   */
  claimInTransaction(
    tx: Database,
    input: { enquiryId: string; owner: UploadOwner; uploadIds: readonly string[] },
  ): Promise<ClaimedEnquiryFiles>;
}

/** Enquiries from the contact form and the private sale enquiry page. */
export interface IMarketingEnquiryRepository {
  /** Stores an enquiry (and its private sale detail) inside the caller's transaction. */
  createInTransaction(tx: Database, input: NewMarketingEnquiry): Promise<MarketingEnquiryRecord>;
  findById(id: string): Promise<MarketingEnquiryRecord | null>;
  /** An enquiry by its reference (E-1042) or its id. */
  findByRef(ref: string): Promise<MarketingEnquiryDetailRecord | null>;
  /** One page of the list, limited to what the scope may see. Returns up to `limit + 1` rows. */
  list(filter: EnquiryListFilter): Promise<MarketingEnquiryRecord[]>;
  /**
   * Applies a change if the enquiry is still at `expectedVersion`, and bumps the version. Returns
   * the updated enquiry, or `null` when the version moved on (or the enquiry is gone).
   */
  updateInTransaction(
    tx: Database,
    id: string,
    expectedVersion: number,
    change: MarketingEnquiryChange,
  ): Promise<MarketingEnquiryRecord | null>;
  /**
   * Closes an open enquiry inside the caller's transaction. Returns the updated enquiry, or `null`
   * when it is not open (already closed or converted, or no such enquiry).
   */
  markHandledInTransaction(
    tx: Database,
    id: string,
    handledByUserId: string,
    at: Date,
  ): Promise<MarketingEnquiryRecord | null>;
}

export type EnquiryNoteRecord = {
  id: string;
  enquiryId: string;
  authorUserId: string | null;
  body: string;
  createdAt: Date;
};

/** Internal notes on an enquiry. */
export interface IEnquiryNoteRepository {
  addInTransaction(
    tx: Database,
    input: { enquiryId: string; authorUserId: string; body: string },
  ): Promise<EnquiryNoteRecord>;
  listForEnquiry(enquiryId: string): Promise<EnquiryNoteRecord[]>;
}

/** Department to specialist routing. */
export interface IEnquiryRoutingRepository {
  listRules(): Promise<EnquiryRoutingRule[]>;
  listRulesInTransaction(tx: Database): Promise<EnquiryRoutingRule[]>;
  /** Replaces every rule with `rules`. */
  replaceRulesInTransaction(
    tx: Database,
    rules: readonly EnquiryRoutingRule[],
    updatedByUserId: string,
  ): Promise<void>;
}
