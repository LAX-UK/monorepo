import type { ISaleExpectedGuestsReader } from "@auction/persistence/interfaces";
import type { SaleExpectedGuestsSummary } from "@auction/types";

export class SaleExpectedGuestsService {
  constructor(private readonly reader: ISaleExpectedGuestsReader) {}

  listForSale(saleId: string): Promise<SaleExpectedGuestsSummary> {
    return this.reader.listForSale(saleId);
  }
}
