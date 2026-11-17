import type {
  DeliveryClosedReason,
  DeliveryQuoteStatus,
  DeliveryStatus,
  FulfilmentFacts,
} from "@auction/domain";

/**
 * One won lot a buyer wants delivered, as the staff Deliveries list reads it: the lot's latest
 * courier quote (a live one before a withdrawn one), the lot, its sale, the buyer account and the
 * lot's fulfilment record. `status` is worked out by `deliveryStatusOf`, never stored.
 */
export type AdminDeliveryRecord = {
  quoteId: string;
  lotId: string;
  status: DeliveryStatus;
  closedReason: DeliveryClosedReason | null;
  awaitingPayment: boolean;
  /** When the delivery reached its status: asked, quoted, accepted, or the fulfilment's last move. */
  statusSince: Date;
  quote: {
    status: DeliveryQuoteStatus;
    /** Where the buyer wants it delivered, as they wrote it. Personal data. */
    destination: string;
    /** Pounds as a decimal string, once quoted. */
    amount: string | null;
    currency: string;
    /** What the price covers, written by staff for the buyer. */
    note: string | null;
    requestedAt: Date;
    quotedAt: Date | null;
    decidedAt: Date | null;
  };
  lot: {
    title: string;
    lotNumber: number | null;
    /** The lot's first photograph, when it has one. */
    imageUrl: string | null;
    dimensions: string | null;
    /** The price the lot sold at, pounds as a decimal string. */
    hammerPrice: string;
  };
  sale: { id: string; title: string; endsAt: Date } | null;
  buyer: { legalEntityId: string; name: string; paddleNumber: number | null };
  fulfilment:
    | (FulfilmentFacts & {
        carrier: string | null;
        trackingNumber: string | null;
        paidAt: Date | null;
        updatedAt: Date;
      })
    | null;
};

export type AdminDeliveriesFilters = {
  /** Lot title or number, paddle, buyer name or destination. */
  search?: string;
  saleId?: string;
};

export type AdminDeliveriesQuery = AdminDeliveriesFilters & {
  status: DeliveryStatus;
  /** Newest first (default), or the one waiting longest first. */
  sort?: "newest" | "oldest";
  limit: number;
  offset: number;
};

/** Deliveries per status for the same search and sale, ignoring the status itself. */
export type AdminDeliveryStatusCounts = Record<DeliveryStatus, number>;

/** Reads for the staff Deliveries list and its panel. No writes. */
export interface IAdminDeliveriesReader {
  list(query: AdminDeliveriesQuery): Promise<{ rows: AdminDeliveryRecord[]; total: number }>;
  counts(filters: AdminDeliveriesFilters): Promise<AdminDeliveryStatusCounts>;
  /** The sales that have at least one delivery, for the sale filter. */
  sales(): Promise<Array<{ id: string; title: string }>>;
  /** A lot's delivery, from its latest quote; null when nobody asked for one. */
  findByLotId(lotId: string): Promise<AdminDeliveryRecord | null>;
}
