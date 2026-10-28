export type PortalOwnedEditionRow = {
  editionId: string;
  artworkId: string;
  artworkSlug: string;
  artworkTitle: string;
  editionNumber: number;
  listingStatus: string;
  custodyStatus: string;
};

export type PortalSaleAuthorityRow = {
  artworkId: string;
  artworkSlug: string;
  artworkTitle: string;
  ownerPartyId: string;
  authorisedCount: number;
  committedCount: number;
  /** Prints the owner holds in the run, sold ones included (not withdrawn ones). */
  ownedCount: number;
  lastGrantAt: string | null;
};

export type CreateSaleAuthorityRequestCommand = {
  identitySubjectId: string;
  artworkId: string;
  requestedCount: number;
  note?: string | undefined;
};

export type CreateSaleAuthorityRequestResult = {
  requestId: string;
  status: "pending";
};

export type WithdrawSaleAuthorityRequestResult = {
  requestId: string;
  status: "cancelled";
};

export type PortalPayoutRow = {
  payoutId: string;
  grossPence: number;
  deductionsPence: number;
  netPence: number;
  status: string;
  payoutDueAt: string;
  paidAt: string | null;
};

export type PortalDocumentRow = {
  documentId: string;
  kind: string;
  createdAt: string;
  downloadUrl: string | null;
};

export type PortalSaleAuthorityRequestRow = {
  requestId: string;
  artworkId: string;
  artworkSlug: string;
  artworkTitle: string;
  requestedCount: number;
  note: string | null;
  status: string;
  createdAt: string;
  handledAt: string | null;
  /** Why LAX declined it; null unless declined. */
  declineReason: string | null;
};

export type PortalCollectionEditionItem = {
  kind: "edition";
  editionId: string;
  artworkId: string;
  artworkSlug: string;
  artworkTitle: string;
  salesChannel: "shop" | "art";
  editionNumber: number;
  listingStatus: string;
  custodyStatus: string;
};

export type PortalCollectionOriginalItem = {
  kind: "original";
  originalSaleId: string;
  artworkId: string;
  artworkSlug: string;
  artworkTitle: string;
  salesChannel: "shop" | "art";
  status: string;
  acquiredAt: string;
};

export type PortalCollectionItem = PortalCollectionEditionItem | PortalCollectionOriginalItem;

export type PortalEnquiryRow = {
  enquiryId: string;
  artworkId: string;
  artworkSlug: string;
  artworkTitle: string;
  salesChannel: "shop" | "art";
  intent: string;
  status: string;
  message: string | null;
  contactPhone: string | null;
  createdAt: string;
};

export type PortalSaleStatementRow = {
  saleId: string;
  channel: "direct" | "third_party" | "original";
  artworkId: string;
  artworkSlug: string;
  artworkTitle: string;
  editionNumber: number | null;
  soldAt: string;
  grossPence: number;
  feesPence: number;
  netPence: number;
  payoutId: string;
  payoutStatus: string;
};

export interface PortalOwnershipReader {
  listOwnedEditions(identitySubjectId: string): Promise<PortalOwnedEditionRow[]>;
  listSaleAuthority(identitySubjectId: string): Promise<PortalSaleAuthorityRow[]>;
  createSaleAuthorityRequest(
    command: CreateSaleAuthorityRequestCommand,
  ): Promise<CreateSaleAuthorityRequestResult>;
  listSaleAuthorityRequests(identitySubjectId: string): Promise<PortalSaleAuthorityRequestRow[]>;
  /** Cancels the person's own pending request; throws not-found or conflict (already decided). */
  withdrawSaleAuthorityRequest(
    identitySubjectId: string,
    requestId: string,
  ): Promise<WithdrawSaleAuthorityRequestResult>;
  listPayouts(identitySubjectId: string): Promise<PortalPayoutRow[]>;
  listDocuments(identitySubjectId: string): Promise<PortalDocumentRow[]>;
  listCollection(identitySubjectId: string): Promise<PortalCollectionItem[]>;
  listEnquiries(identitySubjectId: string): Promise<PortalEnquiryRow[]>;
}

export interface PortalSalesReader {
  listSales(identitySubjectId: string): Promise<PortalSaleStatementRow[]>;
}
