import type { SaleExpectedGuestsSummary } from "@auction/types";
import type { ISaleExpectedGuestsReader } from "../repositories/interfaces/sale-expected-guests.reader.js";

export class SaleExpectedGuestsService {
  constructor(private readonly reader: ISaleExpectedGuestsReader) {}

  listForSale(saleId: string): Promise<SaleExpectedGuestsSummary> {
    return this.reader.listForSale(saleId);
  }
}
