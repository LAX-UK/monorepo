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
  /**
   * When the delivery reached its status, from a recorded event time only: asked, quoted, accepted
   * or withdrawn (the quote's stamps), or collected. `null` when nothing records it: the
   * fulfilment keeps no dispatch, delivery or cancellation time, and its `updated_at` moves on any
   * later edit, so it is never used as one.
   */
  statusSince: Date | null;
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
        /** When the buyer collected the work in person, for a collection that is done. */
        collectedAt: Date | null;
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
  /**
   * The sales with a delivery asked for since `since`, latest sale first, at most `limit`, for the
   * sale filter.
   */
  sales(options: { since: Date; limit: number }): Promise<Array<{ id: string; title: string }>>;
  /** Buyers waiting for a price: the same number as `counts({}).waiting`, counted on its own. */
  waitingCount(): Promise<number>;
  /** A lot's delivery, from its latest quote; null when nobody asked for one. */
  findByLotId(lotId: string): Promise<AdminDeliveryRecord | null>;
}
