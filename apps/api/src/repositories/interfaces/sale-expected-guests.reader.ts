import type { SaleExpectedGuestsSummary } from "@auction/types";

export interface ISaleExpectedGuestsReader {
  listForSale(saleId: string): Promise<SaleExpectedGuestsSummary>;
}
