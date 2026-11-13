/**
 * The buyer's invoice card on a Bid purchase: where the invoice Books issues stands, as the API
 * tells the Bid web app. Figures come from the invoice's frozen lines; a rehearsal (Books in dry
 * run) or a test organisation's document is never shown as a Books invoice, so its state is `lax`
 * (LAX's own invoice, as before). Credit notes are not part of the card yet.
 */
export const PURCHASE_INVOICE_STATES = [
  "lax",
  "preparing",
  "delayed",
  "issued",
  "cancelled",
] as const;
export type PurchaseInvoiceState = (typeof PURCHASE_INVOICE_STATES)[number];

export type PurchaseInvoiceCard = {
  state: PurchaseInvoiceState;
  /** Books' invoice number; only when `issued`. */
  invoiceNumber: string | null;
  /** When Books issued it (ISO 8601, from the document's issue event); only when `issued`. */
  issuedAt: string | null;
  /** The stored copy's document id, for the download link; only when `issued`. */
  invoiceDocumentId: string | null;
  /** When the invoice was cancelled (ISO 8601); only when `cancelled`. */
  cancelledAt: string | null;
  /** The invoice total from its frozen lines, in whole pence. */
  totalPence: number;
};
