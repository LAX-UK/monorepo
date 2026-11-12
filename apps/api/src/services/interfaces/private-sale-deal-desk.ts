import type {
  DealBlockerCode,
  DealView,
  PrivateSalePolicyGap,
  SettlementFollowUpSeverity,
  VatTreatment,
} from "@auction/domain";
import type { PrivateSaleDealListRow } from "@auction/persistence/interfaces";
import type {
  PartyAmlStatus,
  PartyKycStatus,
  PrivateSaleArtworkUnlinkedReason,
  PrivateSaleDealDocument,
  PrivateSaleDealMoney,
  PrivateSaleDealPartyView,
  PrivateSaleDealStage,
  PrivateSalePartyRole,
  PrivateSaleStageHistoryEntry,
  SourceOfFundsStatus,
} from "@auction/types";
import type {
  AdminDealArtworkRemoveInput,
  AdminDealArtworkSearchQuery,
  AdminDealArtworkSetInput,
  AdminDealBuyerInput,
  AdminDealConvertInput,
  AdminDealListQuery,
  AdminDealTerms,
  DealArtworkLock,
  DealArtworkOption,
  DealArtworkSearchResult,
  StaffDealAction,
} from "@auction/validators";
import type { DealStaffViewer } from "../private-sale-deal/deal-staff-permissions.js";

/** Why a move is off right now: a code a screen can key on, and the reason in plain words. */
export type DealActionBlocker = {
  code:
    | DealBlockerCode
    | "no_payment_to_refund"
    | "payout_queued"
    | "refund_unavailable"
    | "refund_amount_invalid"
    | "transfer_details_required"
    | "bank_refund_details_required"
    | "bank_transfer_payment"
    | "not_a_recorded_transfer"
    | "checkout_completed"
    | "checkout_not_ended"
    | "transfer_amount_mismatch"
    | "transfer_in_flight"
    | "deal_not_found"
    | "deal_not_invoiced"
    | "already_paid";
  message: string;
  party?: PrivateSalePartyRole;
};

/** A move the person may make on the deal, and what stands in its way. No blockers means it can be made now. */
export type DealActionState = { action: StaffDealAction; blockers: DealActionBlocker[] };

export type DealListPage = {
  items: PrivateSaleDealListRow[];
  nextCursor: string | null;
  counts: Record<DealView, number>;
  /** How many of the settled deals that need attention may have been sold twice. */
  urgentFollowUps: number;
};

export type DealRecordParty = {
  role: PrivateSalePartyRole;
  legalEntityId: string;
  displayName: string;
  kyc: PartyKycStatus | null;
  aml: PartyAmlStatus | null;
  accepted: boolean;
};

export type DealRecordPayment = {
  status: string;
  rail: string;
  amountMinor: number;
  paidAt: Date | null;
  /** How much of the payment has gone back to the buyer so far. */
  refundedMinor: number;
  /** Finance recorded the bank transfer by hand rather than the buyer paying at the checkout. */
  recordedTransfer: boolean;
};

/** The register artwork a deal holds, drawn the way every deal screen draws it. */
export type DealRecordArtwork = {
  id: string;
  title: string;
  artist: string;
  medium: string | null;
  size: string | null;
  stockCode: string;
  /** Zoho's Status for the artwork. */
  catalogueStatus: string | null;
  thumbnailUrl: string | null;
  whereItIs: DealArtworkOption["whereItIs"];
  /** When the deal took the hold: the latest link or change, else the day the deal opened. */
  heldSince: Date;
  /** The artwork's record in LAX Admin, for people who run deals; `null` without LAX Admin's address. */
  recordHref: string | null;
};

/** One line of a deal's artwork history: who linked, changed or removed it, and why. */
export type DealRecordArtworkMove = {
  action: "linked" | "changed" | "removed";
  from: { title: string; stockCode: string } | null;
  to: { title: string; stockCode: string } | null;
  fromUnlinkedReason: PrivateSaleArtworkUnlinkedReason | null;
  toUnlinkedReason: PrivateSaleArtworkUnlinkedReason | null;
  reason: string | null;
  createdAt: Date;
  actorName: string | null;
};

/** What this person may do to the deal's artwork now, from their role and the deal's stage. */
export type DealArtworkAccess = {
  /** Link an artwork to a deal that has none. */
  canLink: boolean;
  /** Change or remove the linked artwork. */
  canChange: boolean;
  /** Why change and remove are off, for a person who could use them at another stage. */
  changeOffReason: string | null;
};

/**
 * A settled deal whose artwork the register does not show as sold through it. Derived on every
 * read; it is there while the register disagrees and gone the moment it is right.
 */
export type DealRecordSettlementFollowUp = {
  severity: SettlementFollowUpSeverity;
  /** When the deal settled. */
  settledAt: Date;
  /** The register's own reason, words and link, when it shows the artwork somewhere else. */
  lock: DealArtworkLock | null;
  /** This person may ask the register to mark the artwork sold again. */
  canRetry: boolean;
};

export type DealStaffRecord = {
  reference: string;
  stage: PrivateSaleDealStage;
  version: number;
  work: { id: string; title: string; reference: string };
  sourceEnquiryReference: string | null;
  ownerUserId: string | null;
  priceMinor: number | null;
  buyerFeeBps: number;
  sellerCommissionBps: number | null;
  costsMinor: number;
  vatTreatment: string | null;
  partiesDisclosed: boolean;
  offerExpiresAt: Date | null;
  paymentDueAt: Date | null;
  collectionDueAt: Date | null;
  agreedAt: Date | null;
  invoiceReference: string | null;
  cancelReason: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  money: PrivateSaleDealMoney | null;
  /** `null` while no register artwork is linked. */
  artwork: DealRecordArtwork | null;
  /** Why there is no register artwork, when one was recorded. */
  artworkUnlinkedReason: PrivateSaleArtworkUnlinkedReason | null;
  artworkAccess: DealArtworkAccess;
  artworkMoves: DealRecordArtworkMove[];
  /** `null` unless the deal settled and its artwork is not recorded sold through it. */
  settlementFollowUp: DealRecordSettlementFollowUp | null;
  seller: DealRecordParty;
  buyer: DealRecordParty | null;
  /** `null` for people who may not see how the checks stand. */
  sourceOfFunds: {
    status: SourceOfFundsStatus;
    required: boolean;
    thresholdMinor: number;
  } | null;
  documents: Pick<
    PrivateSaleDealDocument,
    "id" | "kind" | "version" | "acceptedAt" | "legalEntityId" | "audience"
  >[];
  payment: DealRecordPayment | null;
  timeline: (Pick<
    PrivateSaleStageHistoryEntry,
    "fromStage" | "toStage" | "reason" | "createdAt"
  > & {
    actorName: string | null;
  })[];
  /** What is still to be set up before a real deal can be agreed and invoiced. */
  policy: {
    gaps: PrivateSalePolicyGap[];
    termsVersion: string | null;
    vatTreatments: VatTreatment[];
  };
  /** The terms this person may change now. */
  editableTerms: (keyof AdminDealTerms)[];
  /** This person may name or change the buyer: the price is not yet agreed. */
  canNameBuyer: boolean;
  actions: DealActionState[];
};

export type DealWriteError =
  | "deal_not_found"
  | "stale_version"
  | "forbidden"
  | "term_locked"
  | "vat_treatment_not_allowed"
  | "buyer_invalid"
  | "buyer_locked"
  | "buyer_is_seller"
  | "blocked"
  | "payment_in_progress"
  /** The artwork change names no artwork and no reason, or names both. */
  | "artwork_choice_required"
  /** The deal has moved past the stage where its artwork can be changed or linked. */
  | "artwork_locked"
  /** The artwork asked for is the one the deal already has. */
  | "artwork_unchanged"
  /** Changing the artwork needs the reason for it. */
  | "reason_required"
  | "artwork_not_found"
  | "artwork_not_original"
  /** The register shows the artwork in another sale, or sold. `lock` says where. */
  | "artwork_unavailable"
  /** The register could not record the change, so nothing was changed. */
  | "artwork_register_busy"
  /** Marking sold applies only to a settled deal with a linked artwork. */
  | "not_settled"
  | "unavailable";

export type DealWriteResult =
  | { ok: true; record: DealStaffRecord }
  | {
      ok: false;
      error: DealWriteError;
      /** The terms that were refused. */
      fields?: (keyof AdminDealTerms)[];
      blockers?: DealActionBlocker[];
      currentVersion?: number;
      /** For `artwork_unavailable`: the register's own reason, words and link. */
      lock?: DealArtworkLock;
      message?: string;
    };

/** The lists and the record, cut to what the person may see. */
export interface IPrivateSaleDealQueries {
  list(viewer: DealStaffViewer, query: AdminDealListQuery): Promise<DealListPage>;
  detail(viewer: DealStaffViewer, ref: string): Promise<DealStaffRecord | null>;
}

/** Every change a person can make to a deal, each against the version they were looking at. */
export interface IPrivateSaleDealCommands {
  updateTerms(
    viewer: DealStaffViewer,
    ref: string,
    change: { version: number; terms: AdminDealTerms },
  ): Promise<DealWriteResult>;
  nameBuyer(
    viewer: DealStaffViewer,
    ref: string,
    input: AdminDealBuyerInput,
  ): Promise<DealWriteResult>;
  act(
    viewer: DealStaffViewer,
    ref: string,
    action: StaffDealAction,
    input: { version: number; reason?: string | undefined; amountMinor?: number | undefined },
  ): Promise<DealWriteResult>;
}

/** Linking, changing and removing a deal's artwork, each held through the register's lock. */
export interface IPrivateSaleDealArtworkCommands {
  /** Links an artwork, changes it, or records why the deal has none. */
  set(
    viewer: DealStaffViewer,
    ref: string,
    input: AdminDealArtworkSetInput,
  ): Promise<DealWriteResult>;
  /** Takes the artwork off a deal that is still being offered, and releases it. */
  remove(
    viewer: DealStaffViewer,
    ref: string,
    input: AdminDealArtworkRemoveInput,
  ): Promise<DealWriteResult>;
}

/** What staff do when a settled deal's artwork was not recorded sold. */
export interface IPrivateSaleDealSettlementCommands {
  /**
   * Asks the register to record the artwork sold through this deal. Safe to repeat: when it is
   * already recorded this answers as done. It never moves an artwork the register shows elsewhere.
   */
  markSold(viewer: DealStaffViewer, ref: string): Promise<DealWriteResult>;
}

/** Staff work on private sale deals here. Who may see or do what is decided in these services. */
export interface IPrivateSaleDealDesk
  extends IPrivateSaleDealQueries,
    IPrivateSaleDealCommands,
    IPrivateSaleDealArtworkCommands,
    IPrivateSaleDealSettlementCommands {}

export type ConvertEnquiryError =
  | "enquiry_not_found"
  | "not_a_private_sale_enquiry"
  | "not_ready"
  | "already_converted"
  /** A guest has no account yet: invite them to create one first. */
  | "account_required"
  | "work_required"
  | "work_not_found"
  | "work_has_no_seller_contact"
  | "buyer_is_seller"
  /** The work is not an approved consignment, or is already on a lot. */
  | "work_not_available"
  /** The work is already in a deal that is neither cancelled nor settled. */
  | "work_in_deal"
  /** The deal needs an artwork from the register, or the reason it is not there: exactly one. */
  | "artwork_choice_required"
  /** The artwork register has no such entry. */
  | "artwork_not_found"
  /** Only originals are held for a deal; prints are sold in runs. */
  | "artwork_not_original"
  /** The register shows the artwork in another sale, or sold. `message` says where. */
  | "artwork_unavailable"
  /** The register was changed by someone else while this was recorded; trying again is safe. */
  | "artwork_register_busy"
  | "stale_version"
  | "unavailable";

export type ConvertEnquiryResult =
  | { ok: true; reference: string }
  | {
      ok: false;
      error: ConvertEnquiryError;
      message?: string;
      /** For `artwork_unavailable`: the register's own reason, words and link, as every product shows them. */
      lock?: DealArtworkLock;
    };

/** Turns a private sale enquiry into a proposed deal. */
export interface IEnquiryConversion {
  convert(
    viewer: { userId: string; readsPrivateSale: boolean },
    enquiryRef: string,
    input: AdminDealConvertInput,
  ): Promise<ConvertEnquiryResult>;
}

export type DealArtworkSearchOutcome =
  | { ok: true; result: DealArtworkSearchResult }
  /** The enquiry the suggestions were asked for does not exist, or this person cannot see it. */
  | { ok: false; error: "enquiry_not_found" };

/** The originals staff can choose from for a deal's artwork. */
export interface IDealArtworkSearch {
  search(
    viewer: { userId: string; readsPrivateSale: boolean },
    query: AdminDealArtworkSearchQuery,
  ): Promise<DealArtworkSearchOutcome>;
}

/** A deal as one of its parties lists it. */
export type PartyDealRow = {
  reference: string;
  role: PrivateSalePartyRole;
  stage: PrivateSaleDealStage;
  workTitle: string;
  workReference: string;
  /** The agreed price, once both sides have it; `null` while it is under discussion. */
  priceMinor: number | null;
  /** The buyer's total including any fee, for the buyer only. */
  totalDueMinor: number | null;
  /** What the seller receives, for the seller only. */
  netToSellerMinor: number | null;
  paymentDueAt: Date | null;
  /** What the person has to do next, in the client's words. */
  needs: PartyDealNeed | null;
  updatedAt: Date;
};

export type PartyDealNeed = "accept_terms" | "verify_identity" | "proof_of_funds" | "pay";

export type PartyDealDetail = {
  view: PrivateSaleDealPartyView;
  work: { title: string; reference: string };
  needs: PartyDealNeed | null;
  /** The version of the terms the person has still to accept; `null` when there is nothing to accept. */
  termsToAccept: string | null;
  /** The buyer may pay: the deal is invoiced and their checks are clear. */
  payable: boolean;
};

export type AcceptTermsError =
  | "deal_not_found"
  | "terms_not_configured"
  | "not_open_for_terms"
  | "unavailable";

export type AcceptTermsResult =
  | { ok: true; detail: PartyDealDetail }
  | { ok: false; error: AcceptTermsError };

export type PayDealError =
  | "deal_not_found"
  /** The deal is not invoiced, or has no price to pay. */
  | "not_payable"
  /** Their identity or screening is not clear, so no money is taken. */
  | "compliance_hold"
  /** The amount is above what the online rails take; finance arranges the payment. */
  | "not_payable_online"
  | "already_paid"
  /** A bank transfer is on its way; nothing more to do. */
  | "in_progress"
  | "unavailable";

export type PayDealResult =
  | { ok: true; checkoutUrl: string; amountMinor: number }
  | { ok: false; error: PayDealError };

/** What a buyer or seller sees of their own deals. The other side is never revealed here. */
export interface IPrivateSaleDealParties {
  list(userId: string): Promise<PartyDealRow[]>;
  detail(userId: string, ref: string): Promise<PartyDealDetail | null>;
  acceptTerms(userId: string, ref: string): Promise<AcceptTermsResult>;
  /** Opens the one checkout that pays the deal. Only the person acting for the buyer may pay. */
  pay(userId: string, ref: string): Promise<PayDealResult>;
}
