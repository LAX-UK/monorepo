export type GrantSaleAuthorityCommand = {
  artworkId: string;
  ownerPartyId: string;
  authorisedCount: number;
  evidenceNote: string;
  recordedBySubjectId: string;
  requestId?: string | undefined;
};

export type GrantSaleAuthorityResult = {
  grantId: string;
  artworkId: string;
  ownerPartyId: string;
  authorisedCount: number;
  editionNumbersAuthorised: number[];
  editionNumbersRevoked: number[];
};

export interface SaleAuthorityWriter {
  grantSaleAuthority(command: GrantSaleAuthorityCommand): Promise<GrantSaleAuthorityResult>;
}
