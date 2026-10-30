export type BuyerAgentAuthorisationRow = {
  saleId: string | null;
  bidLimit: string | null;
  /** Decimal string in major units, or `null` for no total. */
  totalLimit: string | null;
};

export interface IBuyerAgentAuthorisationReader {
  findActiveAuthorisations(params: {
    legalEntityId: string;
    userId: string;
    saleId: string | null;
    now: Date;
  }): Promise<BuyerAgentAuthorisationRow[]>;
}
