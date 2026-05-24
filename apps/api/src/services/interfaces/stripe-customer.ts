export interface IStripeCustomerGateway {
  isConfigured(): boolean;
  findOrCreateForLegalEntity(input: {
    legalEntityId: string;
    buyerEmail: string;
    buyerName: string;
  }): Promise<string>;
}
