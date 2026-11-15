import type {
  CollectionBookingOffer,
  DeliveryQuoteAction,
  DeliveryQuoteStatus,
  PurchaseCollectBy,
  PurchaseDeliveryStage,
  PurchaseInvoiceStatus,
  PurchasePaymentRole,
} from "@auction/domain";

/** A member named on a record: who registered, placed a bid or won a lot. */
export type RecordPersonView = { userId: string; name: string | null };

/** One sale the acting account is registered for (the Bids "Sales" view). */
export type AccountRegistrationView = {
  id: string;
  saleId: string;
  saleTitle: string;
  saleStartsAt: Date;
  saleEndsAt: Date;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  paddleNumber: number | null;
  /** The per-lot limit in pounds, `null` for none or not yet set. */
  bidLimit: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
  registeredBy: RecordPersonView;
};

/** A courier quote as the purchase shows it, with the steps open to this member. */
export type PurchaseQuoteView = {
  id: string;
  status: DeliveryQuoteStatus;
  destination: string;
  amount: string | null;
  currency: string;
  quoteNote: string | null;
  requestedAt: Date;
  quotedAt: Date | null;
  actions: DeliveryQuoteAction[];
};

/** What the account's purchase list knows about one won lot. */
export type AccountPurchaseFacts = {
  lotId: string;
  wonBy: RecordPersonView | null;
  paymentRole: PurchasePaymentRole;
  invoice: {
    status: PurchaseInvoiceStatus;
    dueAt: Date | null;
    paymentId: string | null;
    totalDue: string | null;
    /**
     * What a part-funded bank transfer still has to send for this invoice, in whole pence; `null`
     * when it is not inside one. Its share of the group's whole remainder.
     */
    stillToSendPence: number | null;
  };
  delivery: {
    stage: PurchaseDeliveryStage;
    method: "collection" | "shipping" | null;
    carrier: string | null;
    trackingNumber: string | null;
    collectedBy: string | null;
    collectedAt: Date | null;
    quote: PurchaseQuoteView | null;
    /**
     * "Please collect by" while the work waits to be collected; the API works it out. `placeId` is
     * the venue it waits at (what a visit is booked at; names are not unique), `null` from an API
     * that predates it. `placeName` is where it waits, as the reminder email names it.
     */
    collectBy: (PurchaseCollectBy & { placeId: string | null; placeName: string }) | null;
  };
};

export type { CollectionBookingOffer };
