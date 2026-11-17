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
    | "collected"
    | "cancelled";
  /**
   * When it happened, from a recorded event time. `null` when nothing records it: dispatch,
   * delivery and cancellation keep no time of their own (the fulfilment's `updated_at` moves on
   * any later edit, so it is never shown as one).
   */
  at: string | null;
  /** Who took the step: the buyer, or the LAX team (a `withdrawn` by staff is a decline). */
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
  /** When the delivery reached its status, when a recorded event time says so; else `null`. */
  statusSince: string | null;
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
    /** Why the team declined it ("Can't deliver"), as the buyer was told; else `null`. */
    declineReason: string | null;
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
        /** When the buyer collected the work in person. */
        collectedAt: string | null;
      })
    | null;
  /** Oldest first; steps with no recorded time come last, in the order they happen. */
  history: AdminDeliveryEvent[];
};

export type AdminDeliveriesPage = {
  items: AdminDeliveryView[];
  total: number;
  offset: number;
  limit: number;
  /** Deliveries per status for the same search and sale, whichever view is shown. */
  counts: Record<DeliveryStatus, number>;
  /** The sales with a delivery asked for in the last year, latest first, at most 100. */
  sales: Array<{ id: string; title: string }>;
};

/** Reads for the staff Deliveries screen. Pricing a quote stays on the lot fulfilment route. */
export interface IAdminDeliveriesService {
  list(query: AdminDeliveriesListQuery): Promise<AdminDeliveriesPage>;
  /** The sidebar count: buyers waiting for a price. */
  summary(): Promise<{ waitingCount: number }>;
  detail(lotId: string): Promise<AdminDeliveryView | null>;
}
