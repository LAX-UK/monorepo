import type {
  DeliveryClosedReason,
  DeliveryQuoteStatus,
  DeliveryStatus,
  FulfilmentFacts,
} from "@auction/domain";
import type { AdminDeliveriesListQuery } from "@auction/validators";

/** One step in a delivery's history, from the quote's and the fulfilment's own stamps. */
export type AdminDeliveryEvent = {
  kind:
    | "requested"
    | "quoted"
    | "accepted"
    | "withdrawn"
    | "dispatched"
    | "delivered"
    | "cancelled";
  at: string;
  /** Who took the step: the buyer, or the LAX team. */
  by: "buyer" | "staff";
};

/**
 * A won lot a buyer wants delivered, as the staff Deliveries list and its panel show it
 * (docs/design/staff-gaps-delivery-zoho-alerts.md, D2–D4). Times are ISO; money is in pence.
 */
export type AdminDeliveryView = {
  lotId: string;
  quoteId: string;
  status: DeliveryStatus;
  closedReason: DeliveryClosedReason | null;
  awaitingPayment: boolean;
  /** When the delivery reached its status. */
  statusSince: string;
  /** Where the buyer wants it delivered, as they wrote it. Personal data. */
  destination: string;
  quote: {
    status: DeliveryQuoteStatus;
    amountMinor: number | null;
    currency: string;
    note: string | null;
    requestedAt: string;
    quotedAt: string | null;
    decidedAt: string | null;
  };
  lot: {
    title: string;
    lotNumber: number | null;
    imageUrl: string | null;
    dimensions: string | null;
    hammerMinor: number;
  };
  sale: { id: string; title: string; endsAt: string } | null;
  buyer: { legalEntityId: string; name: string; paddleNumber: number | null };
  fulfilment:
    | (FulfilmentFacts & {
        carrier: string | null;
        trackingNumber: string | null;
        paidAt: string | null;
        updatedAt: string;
      })
    | null;
  /** Oldest first. */
  history: AdminDeliveryEvent[];
};

export type AdminDeliveriesPage = {
  items: AdminDeliveryView[];
  total: number;
  offset: number;
  limit: number;
  /** Deliveries per status for the same search and sale, whichever view is shown. */
  counts: Record<DeliveryStatus, number>;
  /** The sales that have deliveries, for the sale filter. */
  sales: Array<{ id: string; title: string }>;
};

/** Reads for the staff Deliveries screen. Pricing a quote stays on the lot fulfilment route. */
export interface IAdminDeliveriesService {
  list(query: AdminDeliveriesListQuery): Promise<AdminDeliveriesPage>;
  /** The sidebar count: buyers waiting for a price. */
  summary(): Promise<{ waitingCount: number }>;
  detail(lotId: string): Promise<AdminDeliveryView | null>;
}
