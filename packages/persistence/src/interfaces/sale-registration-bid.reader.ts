export type SaleRegistrationBidRow = {
  status: string;
  bidLimit: string | null;
};

export interface ISaleRegistrationBidReader {
  findRegistration(
    saleId: string,
    userId: string,
    buyerLegalEntityId: string,
  ): Promise<SaleRegistrationBidRow | null>;
}
