import type { AdminDisputeCaseRow } from "@auction/types";

export type AdminDisputePaymentRow = {
  id: string;
  lotId: string;
  buyerId: string;
  sellerLegalEntityId: string;
};

export interface IAdminDisputeCaseEnrichmentReader {
  findPaymentsByIds(paymentIds: string[]): Promise<AdminDisputePaymentRow[]>;
  findLotTitlesByIds(lotIds: string[]): Promise<Map<string, string>>;
  findBuyerLabelsByIds(buyerIds: string[]): Promise<Map<string, string | null>>;
  findSellerDisplayNamesByIds(sellerIds: string[]): Promise<Map<string, string>>;
  enrichCases(cases: AdminDisputeCaseRow[]): Promise<AdminDisputeCaseRow[]>;
}
