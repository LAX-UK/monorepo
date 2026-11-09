import type { DeliveryQuoteStatus } from "@auction/domain";
import type { DeliveryQuoteEndReason } from "@auction/shop-domain";
import type { ShopAdminAuditWriter } from "../ports/shop-admin-audit.writer.js";
import type { ShopAdminCommandWriter } from "../ports/shop-admin-command.writer.js";

/** One delivery quote request as staff read it. */
export type DeliveryQuoteStaffRow = {
  id: string;
  orderId: string;
  orderReference: string;
  status: DeliveryQuoteStatus;
  /** ISO 3166-1 alpha-2. */
  country: string;
  regionId: "eu" | "north_america" | "asia_pacific" | null;
  recipientName: string | null;
  address: string[];
  phone: string | null;
  items: string[];
  merchandisePence: number;
  requestedAt: Date;
  holdUntil: Date;
  quote: {
    pricePence: number;
    carrier: string;
    service: string | null;
    leadTimeNote: string | null;
    quotedAt: Date;
  } | null;
  endReason: DeliveryQuoteEndReason | null;
  declineNote: string | null;
};

export type DeliveryQuoteView = "waiting" | "quoted" | "closed";

/** A quote and its order, locked for a change, with who to write to. */
export type DeliveryQuoteForUpdate = {
  row: DeliveryQuoteStaffRow;
  orderStatus: string;
  identitySubjectId: string;
  /** The guest's email; null for an account, whose address is read from the account. */
  guestEmail: string | null;
};

export interface DeliveryQuoteStaffReader {
  list(view: DeliveryQuoteView): Promise<DeliveryQuoteStaffRow[]>;
  /** Requests waiting for staff: the count on the tab. */
  waitingCount(): Promise<number>;
}

export interface DeliveryQuoteStaffStore {
  /** Locks the quote and its order until the transaction ends; null when there is none. */
  lock(quoteId: string): Promise<DeliveryQuoteForUpdate | null>;
  saveQuote(input: {
    quoteId: string;
    orderId: string;
    pricePence: number;
    carrier: string;
    service: string | null;
    leadTimeNote: string | null;
    actorSubjectId: string;
    at: Date;
    /** The new hold: the prints stay reserved, and the request stays open, until then. */
    holdUntil: Date;
  }): Promise<void>;
  decline(input: { quoteId: string; note: string; at: Date }): Promise<void>;
}

/** The buyer's emails, queued in the transaction that changes the quote. */
export interface DeliveryQuoteStaffMail {
  quoteReady(input: {
    quote: DeliveryQuoteForUpdate;
    pricePence: number;
    carrier: string;
    service: string | null;
    leadTimeNote: string | null;
    holdUntil: Date;
  }): Promise<void>;
  quoteDeclined(input: { quote: DeliveryQuoteForUpdate; note: string }): Promise<void>;
}

export type DeliveryQuoteStaffTx = {
  store: DeliveryQuoteStaffStore;
  mail: DeliveryQuoteStaffMail;
  audit: ShopAdminAuditWriter;
  commands: ShopAdminCommandWriter;
};

export interface DeliveryQuoteStaffUnitOfWork {
  run<T>(fn: (tx: DeliveryQuoteStaffTx) => Promise<T>): Promise<T>;
}

/** Releases the prints and returns the basket once a request has been turned down. */
export interface DeliveryQuoteOrderReleaser {
  release(orderId: string, quoteId: string): Promise<void>;
}
