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

export interface PortalOwnershipReader {
  listOwnedEditions(identitySubjectId: string): Promise<PortalOwnedEditionRow[]>;
  listSaleAuthority(identitySubjectId: string): Promise<PortalSaleAuthorityRow[]>;
  createSaleAuthorityRequest(
    command: CreateSaleAuthorityRequestCommand,
  ): Promise<CreateSaleAuthorityRequestResult>;
  listPayouts(identitySubjectId: string): Promise<PortalPayoutRow[]>;
  listDocuments(identitySubjectId: string): Promise<PortalDocumentRow[]>;
}
