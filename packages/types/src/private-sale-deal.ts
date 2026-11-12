/**
 * A private sale deal: one work, one seller, one buyer and one agreed price, sold by private
 * treaty through LAX Bid. These are the shapes shared by the domain, the persistence layer and
 * the API; the rules that move a deal between stages live in `@auction/domain`.
 */

/** The stages in the order a deal moves through them. `cancelled` is reachable until it is settled. */
export const PRIVATE_SALE_DEAL_STAGES = [
  "proposed",
  "offer",
  "agreed",
  "cleared",
  "invoiced",
  "paid",
  "released",
  "settled",
  "cancelled",
] as const;
export type PrivateSaleDealStage = (typeof PRIVATE_SALE_DEAL_STAGES)[number];

export const PRIVATE_SALE_PARTY_ROLES = ["seller", "buyer"] as const;
export type PrivateSalePartyRole = (typeof PRIVATE_SALE_PARTY_ROLES)[number];

/** Identity verification of a party, read from the existing KYC records. */
export type PartyKycStatus = "clear" | "pending" | "failed";
/** AML screening of a party; `review` is a possible or confirmed match waiting for Compliance. */
export type PartyAmlStatus = "clear" | "pending" | "review" | "blocked";
/** The buyer's source of funds, read from the existing source-of-funds records. */
export type SourceOfFundsStatus = "approved" | "pending" | "declined" | "not_requested";

export const PRIVATE_SALE_DOCUMENT_KINDS = [
  "terms",
  "nda",
  "condition_report",
  "provenance",
  "invoice",
  "other",
] as const;
export type PrivateSaleDocumentKind = (typeof PRIVATE_SALE_DOCUMENT_KINDS)[number];

/** Who may see a document. `staff` documents never reach either party. */
export const PRIVATE_SALE_DOCUMENT_AUDIENCES = ["staff", "seller", "buyer", "both"] as const;
export type PrivateSaleDocumentAudience = (typeof PRIVATE_SALE_DOCUMENT_AUDIENCES)[number];

/** One side of a deal: the legal entity (person or organisation) and who acts for it. */
export type PrivateSaleDealParty = {
  role: PrivateSalePartyRole;
  legalEntityId: string;
  displayName: string;
  actingUserId: string | null;
};

/**
 * A reference to a document held for the deal, or the record that a party accepted the terms or
 * NDA. The file itself lives in object storage; this row only points at it.
 */
export type PrivateSaleDealDocument = {
  id: string;
  dealId: string;
  kind: PrivateSaleDocumentKind;
  audience: PrivateSaleDocumentAudience;
  /** The party the document was accepted by or issued to; `null` for a document that is not party specific. */
  legalEntityId: string | null;
  /** The terms or NDA version the document or acceptance refers to. */
  version: string | null;
  uploadObjectId: string | null;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
};

/**
 * Why a deal has no artwork in the register. Only `sellers_own_work` lets the deal be agreed: it
 * is not gallery stock. `in_zoho_not_linked` is a note that the artwork still has to be linked.
 */
export const PRIVATE_SALE_ARTWORK_UNLINKED_REASONS = [
  "sellers_own_work",
  "in_zoho_not_linked",
] as const;
export type PrivateSaleArtworkUnlinkedReason =
  (typeof PRIVATE_SALE_ARTWORK_UNLINKED_REASONS)[number];

/** The deal as stored. Money is in pence, GBP only. */
export type PrivateSaleDeal = {
  id: string;
  /** What staff and clients quote: PS-0001 upwards. */
  reference: string;
  stage: PrivateSaleDealStage;
  itemSubmissionId: string;
  /** The artwork register entry for the work. A deal is agreed only once it has one or a reason. */
  artworkRegisterId: string | null;
  /** Why the deal has no register artwork; `null` while one is linked or nothing was recorded. */
  artworkUnlinkedReason: PrivateSaleArtworkUnlinkedReason | null;
  sourceEnquiryId: string | null;
  sourceUnsoldLotChoiceId: string | null;
  ownerUserId: string | null;
  /** `null` until a price is agreed. */
  priceMinor: number | null;
  /** The fee charged to the buyer on top of the price. None unless set. */
  buyerFeeBps: number;
  /** `null` until set, from configuration or by finance; the invoice waits for it. */
  sellerCommissionBps: number | null;
  costsMinor: number;
  /** A code from the configured list; `null` until finance chooses one. */
  vatTreatment: string | null;
  /** Whether each side may see who the other is. They may not unless this is set. */
  partiesDisclosed: boolean;
  offerExpiresAt: Date | null;
  paymentDueAt: Date | null;
  collectionDueAt: Date | null;
  agreedAt: Date | null;
  agreedByUserId: string | null;
  invoicedByUserId: string | null;
  /** The invoice's reference in the finance system that issued it; `null` until one exists. */
  invoiceReference: string | null;
  cancelReason: string | null;
  cancelledAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PrivateSaleDealDetail = PrivateSaleDeal & {
  seller: PrivateSaleDealParty;
  /** `null` while the deal is proposed. */
  buyer: PrivateSaleDealParty | null;
  documents: readonly PrivateSaleDealDocument[];
};

/** One append-only row per stage change. */
export type PrivateSaleStageHistoryEntry = {
  id: string;
  dealId: string;
  fromStage: PrivateSaleDealStage | null;
  toStage: PrivateSaleDealStage;
  /** `null` when the system made the change, such as clearing a deal when its checks pass. */
  actorUserId: string | null;
  reason: string | null;
  createdAt: Date;
};

/** What a stage change writes to the deal alongside the new stage. */
export type PrivateSaleStageChanges = {
  agreedAt?: Date;
  agreedByUserId?: string | null;
  invoicedByUserId?: string | null;
  paymentDueAt?: Date;
  collectionDueAt?: Date;
  cancelReason?: string;
  cancelledAt?: Date;
};

export type PrivateSaleStageChange = {
  from: PrivateSaleDealStage;
  to: PrivateSaleDealStage;
  actorUserId: string | null;
  reason: string | null;
  changes: PrivateSaleStageChanges;
};

/** The money lines of a deal, all in pence. `null` lines are not known yet. */
export type PrivateSaleDealMoney = {
  priceMinor: number;
  buyerFeeMinor: number;
  totalDueMinor: number;
  sellerCommissionMinor: number | null;
  costsMinor: number;
  netToSellerMinor: number | null;
};

/** What staff see: everything, including both parties and their checks. */
export type PrivateSaleDealStaffView = {
  audience: "staff";
  deal: PrivateSaleDealDetail;
  money: PrivateSaleDealMoney | null;
};

/** The other side as one party may see it. */
export type PrivateSaleCounterpartyView =
  | { disclosed: false; label: "LAX" }
  | { disclosed: true; label: string };

/**
 * What one party may see: their own side, the other side only as LAX unless the deal discloses
 * parties, and only the money lines that concern them. Never the other side's identifiers,
 * checks, fees or internal documents.
 */
export type PrivateSaleDealPartyView = {
  audience: PrivateSalePartyRole;
  reference: string;
  stage: PrivateSaleDealStage;
  itemSubmissionId: string;
  you: { legalEntityId: string; displayName: string };
  counterparty: PrivateSaleCounterpartyView;
  /** `agreed` once both sides have accepted a price; until then the price is under discussion. */
  priceState: "under_discussion" | "agreed";
  /** The buyer's side: the price, the fee and the total due. */
  buyerMoney: Pick<PrivateSaleDealMoney, "priceMinor" | "buyerFeeMinor" | "totalDueMinor"> | null;
  /** The seller's side: the price, their commission, costs and what they receive. */
  sellerMoney: Omit<PrivateSaleDealMoney, "buyerFeeMinor" | "totalDueMinor"> | null;
  paymentDueAt: Date | null;
  collectionDueAt: Date | null;
  documents: readonly Pick<
    PrivateSaleDealDocument,
    "id" | "kind" | "version" | "acceptedAt" | "uploadObjectId"
  >[];
};
