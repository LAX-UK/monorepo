export type BuyerAgentAuthorisationRow = {
  saleId: string | null;
  bidLimit: string | null;
};

export interface IBuyerAgentAuthorisationReader {
  findActiveAuthorisations(params: {
    legalEntityId: string;
    userId: string;
    saleId: string | null;
    now: Date;
  }): Promise<BuyerAgentAuthorisationRow[]>;
}
