import type {
  CollectionBookingOffer,
  DeliveryQuoteAction,
  DeliveryQuoteStatus,
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
  };
  delivery: {
    stage: PurchaseDeliveryStage;
    method: "collection" | "shipping" | null;
    carrier: string | null;
    trackingNumber: string | null;
    collectedBy: string | null;
    collectedAt: Date | null;
    quote: PurchaseQuoteView | null;
  };
};

export type { CollectionBookingOffer };
