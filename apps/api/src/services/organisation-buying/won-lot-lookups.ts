import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";
import { collectionPlaceOf } from "../lot-fulfilment/lot-fulfilment-buyer-notifier.js";
import type { ICollectionPlaceLookup } from "./collection-booking.service.js";
import type { IQuoteLotLookup } from "./delivery-quote.service.js";

/** Reads what the buying services need to know about a won lot from the lot and its sale. */
export class WonLotLookups implements IQuoteLotLookup, ICollectionPlaceLookup {
  constructor(
    private readonly lots: Pick<ILotRepository, "findById">,
    private readonly sales: Pick<ISaleRepository, "findById">,
  ) {}

  async buyerAccountOf(lotId: string): Promise<string | null> {
    const lot = await this.lots.findById(lotId);
    return lot?.status === "ended" ? (lot.buyerLegalEntityId ?? null) : null;
  }

  async placeForLot(lotId: string): Promise<string | null> {
    const lot = await this.lots.findById(lotId);
    if (!lot?.saleId) return null;
    return collectionPlaceOf(await this.sales.findById(lot.saleId));
  }
}
