import type {
  PrivateSaleArtworkUnlinkedReason,
  PrivateSaleDealDetail,
  PrivateSaleDealDocument,
  PrivateSaleDocumentKind,
  PrivateSalePartyRole,
  PrivateSaleStageChange,
  PrivateSaleStageHistoryEntry,
} from "@auction/types";

export type NewPrivateSaleDeal = {
  itemSubmissionId: string;
  artworkRegisterId?: string | null;
  /** Why the deal has no register artwork; only set when `artworkRegisterId` is not. */
  artworkUnlinkedReason?: PrivateSaleArtworkUnlinkedReason | null;
  sourceEnquiryId?: string | null;
  sourceUnsoldLotChoiceId?: string | null;
  ownerUserId: string | null;
  seller: { legalEntityId: string; actingUserId: string | null };
  /** Named when the deal starts from a buy enquiry; otherwise added before the offer. */
  buyer?: { legalEntityId: string; actingUserId: string | null };
  /** From configuration: the buyer's fee (none by default) and the seller's commission once set. */
  buyerFeeBps: number;
  sellerCommissionBps: number | null;
  actorUserId: string | null;
};

/** Terms staff may change while the stage allows it; each key is a column of the deal. */
export type PrivateSaleDealTermsPatch = Partial<{
  priceMinor: number | null;
  buyerFeeBps: number;
  sellerCommissionBps: number | null;
  costsMinor: number;
  vatTreatment: string | null;
  partiesDisclosed: boolean;
  offerExpiresAt: Date | null;
  ownerUserId: string | null;
}>;

export type PrivateSaleDealWriteResult =
  | { kind: "ok"; deal: PrivateSaleDealDetail }
  | { kind: "not_found" }
  /** Someone changed the deal since it was read. Read it again before retrying. */
  | { kind: "conflict" };

export interface IPrivateSaleDealReader {
  findById(id: string): Promise<PrivateSaleDealDetail | null>;
  findByReference(reference: string): Promise<PrivateSaleDealDetail | null>;
  /** Oldest first. */
  history(dealId: string): Promise<PrivateSaleStageHistoryEntry[]>;
}

export interface IPrivateSaleDealWriter {
  /** Opens the deal as proposed and writes the first history row, in one transaction. */
  create(input: NewPrivateSaleDeal): Promise<PrivateSaleDealDetail>;
  /** Names or replaces a party. Replacing the buyer starts their acceptance of the terms again. */
  setParty(
    dealId: string,
    expectedVersion: number,
    party: { role: PrivateSalePartyRole; legalEntityId: string; actingUserId: string | null },
  ): Promise<PrivateSaleDealWriteResult>;
  updateTerms(
    dealId: string,
    expectedVersion: number,
    patch: PrivateSaleDealTermsPatch,
  ): Promise<PrivateSaleDealWriteResult>;
  /**
   * Applies a stage change the state machine allowed and appends its history row, in one
   * transaction. Refused as a conflict if the deal is no longer in the stage the change leaves.
   */
  applyStageChange(
    dealId: string,
    expectedVersion: number,
    change: PrivateSaleStageChange,
  ): Promise<PrivateSaleDealWriteResult>;
}

export type NewPrivateSaleDocument = {
  dealId: string;
  kind: PrivateSaleDocumentKind;
  audience: PrivateSaleDealDocument["audience"];
  legalEntityId: string | null;
  version: string | null;
  uploadObjectId: string | null;
  createdByUserId: string | null;
};

export interface IPrivateSaleDocumentWriter {
  add(input: NewPrivateSaleDocument): Promise<PrivateSaleDealDocument>;
  /**
   * Records that a party accepted a version of the terms or NDA. Accepting the same version
   * again returns the acceptance already recorded.
   */
  recordAcceptance(input: {
    dealId: string;
    kind: Extract<PrivateSaleDocumentKind, "terms" | "nda">;
    legalEntityId: string;
    version: string;
    userId: string;
    at: Date;
  }): Promise<PrivateSaleDealDocument>;
}
