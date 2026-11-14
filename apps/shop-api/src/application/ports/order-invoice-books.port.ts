import type { TargetMode } from "@auction/accounting-domain";

/** One Books invoice document for a Shop order, as much of it as the buyer's card needs. */
export type OrderInvoiceBooksDocument = {
  documentId: string;
  targetMode: TargetMode;
  /** The document's state in the life cycle ("pending", "issued", "needs_review", ...). */
  state: string;
  /** The provider's number once issued, else null. */
  providerNumber: string | null;
  /** When it was issued: its transition to `issued` in the event log. Null until then. */
  issuedAt: Date | null;
  /** LAX's stored copy of its PDF, if one is kept. */
  copy: { storageKey: string; rehearsal: boolean } | null;
};

/** The order's Books invoice documents (one per target), and where the switch aims the Shop now. */
export type OrderInvoiceBooks = {
  /** The mode the switch aims Shop documents at in Books now; null when not aimed or unreadable. */
  booksMode: TargetMode | null;
  documents: OrderInvoiceBooksDocument[];
};

/** Reads one Shop order's Books invoice documents (read only, column by column). */
export interface OrderInvoiceBooksReader {
  read(orderId: string): Promise<OrderInvoiceBooks>;
}

/** LAX's document storage, where the stored copies are; read only. */
export interface InvoiceCopyStorage {
  getObjectBytes(key: string, maxBytes: number): Promise<Buffer | null>;
}
