import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";
import type { Sale } from "@auction/types";
import type { INotificationFactory } from "../interfaces/notification-factory.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";

export type LotFulfilmentStep =
  | { kind: "ready_for_collection"; lotId: string }
  | { kind: "shipped"; lotId: string; carrier: string; trackingNumber: string }
  | { kind: "delivered"; lotId: string; method: "delivery" | "collection" };

/** Tells the winning bidder, in the product and by email, that their lot moved on. */
export interface ILotFulfilmentBuyerNotifier {
  notify(step: LotFulfilmentStep): Promise<void>;
}

type RowFactory = Pick<
  INotificationFactory,
  "createLotReadyForCollection" | "createLotShipped" | "createLotDelivered"
>;

type SaleLocation = Pick<
  Sale,
  | "locationName"
  | "locationAddress"
  | "locationAddressLine1"
  | "locationAddressLine2"
  | "locationCity"
  | "locationPostcode"
>;

/** Where a sale's lots are collected, as one line; null when the sale has no venue details. */
export function collectionPlaceOf(sale: SaleLocation | null): string | null {
  if (!sale) return null;
  const structured = [
    sale.locationAddressLine1,
    sale.locationAddressLine2,
    sale.locationCity,
    sale.locationPostcode,
  ];
  const address = structured.some(Boolean)
    ? structured
    : [sale.locationAddress?.replace(/\s*\n+\s*/g, ", ")];
  const parts = [sale.locationName, ...address]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Best effort: a notice that cannot be sent never fails the fulfilment step it describes. Each
 * lot and step carries one key, so the in-product notice and the email go out once.
 */
export class LotFulfilmentBuyerNotifier implements ILotFulfilmentBuyerNotifier {
  constructor(
    private readonly lots: Pick<ILotRepository, "findById">,
    private readonly sales: Pick<ISaleRepository, "findById">,
    private readonly dispatcher: Pick<NotificationDispatcher, "dispatch">,
    private readonly factory: RowFactory,
  ) {}

  async notify(step: LotFulfilmentStep): Promise<void> {
    try {
      const lot = await this.lots.findById(step.lotId);
      if (!lot?.winnerId) return;
      const buyerId = lot.winnerId;

      let row: ReturnType<RowFactory["createLotShipped"]>;
      if (step.kind === "shipped") {
        row = this.factory.createLotShipped(lot, buyerId, {
          carrier: step.carrier,
          trackingNumber: step.trackingNumber,
        });
      } else if (step.kind === "delivered") {
        row = this.factory.createLotDelivered(lot, buyerId, { method: step.method });
      } else {
        const sale = lot.saleId ? await this.sales.findById(lot.saleId) : null;
        row = this.factory.createLotReadyForCollection(lot, buyerId, {
          collectionPlace: collectionPlaceOf(sale),
        });
      }

      const key = `lot-fulfilment:${step.lotId}:${row.type}`;
      const payload = notificationRowToPayload(row);
      await this.dispatcher.dispatch(buyerId, {
        ...payload,
        meta: { ...payload.meta, outboxIdempotencyKey: key, emailIdempotencyKey: key },
      });
    } catch (err) {
      console.error("[LotFulfilmentBuyerNotifier] notice failed", { lotId: step.lotId, err });
    }
  }
}
