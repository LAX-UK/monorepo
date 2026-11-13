/**
 * The buyer's invoice card on a Bid purchase: where the invoice Books issues stands, as the API
 * tells the Bid web app. Figures come from the invoice's frozen lines; a rehearsal (Books in dry
 * run) is never shown as a Books invoice, so its state is `lax` (LAX's own invoice, as before).
 */
export const PURCHASE_INVOICE_STATES = [
  "lax",
  "preparing",
  "delayed",
  "issued",
  "cancelled",
] as const;
export type PurchaseInvoiceState = (typeof PURCHASE_INVOICE_STATES)[number];

/** A credit note issued against the invoice, with LAX's stored copy to download. */
export type PurchaseCreditNote = {
  /** The stored copy's document id, for the download link. */
  documentId: string;
  /** Books' credit note number. */
  number: string;
  /** What it credits, in whole pence (positive). */
  amountPence: number;
};

export type PurchaseInvoiceCard = {
  state: PurchaseInvoiceState;
  /** Books' invoice number; only when `issued`. */
  invoiceNumber: string | null;
  /** When Books issued it (ISO 8601); only when `issued`. */
  issuedAt: string | null;
  /** The stored copy's document id, for the download link; only when `issued`. */
  invoiceDocumentId: string | null;
  /** When the invoice was cancelled (ISO 8601); only when `cancelled`. */
  cancelledAt: string | null;
  /** The invoice total from its frozen lines, in whole pence. */
  totalPence: number;
  /** Credit notes with a stored copy, oldest first; empty until there are any. */
  creditNotes: PurchaseCreditNote[];
};
