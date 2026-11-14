/**
 * The buyer's invoice card on a Bid purchase: where the invoice Books issues stands, as the API
 * tells the Bid web app. Figures come from the invoice's frozen lines; a rehearsal (Books in dry
 * run) or a test organisation's document is never shown as a Books invoice, so its state is `lax`
 * (LAX's own invoice, as before). Credit notes follow the same rule: one is listed only once Books
 * issued it live and LAX holds its copy.
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
  /**
   * The invoice was cancelled after a buyer default (a default's credit note exists for it); only
   * when `cancelled`.
   */
  cancelledAfterDefault: boolean;
  /** Credit notes Books issued live for it with LAX's copy stored, oldest first. */
  creditNotes: PurchaseCreditNote[];
};

/** A credit note on a Bid invoice: a refund's, or the one that cancels it after a default. */
export type PurchaseCreditNote = {
  /** The stored copy's document id, for the download link. */
  documentId: string;
  /** Books' credit note number. */
  number: string;
  /** What it credits, VAT included, in whole pence. */
  grossPence: number;
  /** When Books issued it (ISO 8601, from its issue event). */
  issuedAt: string | null;
  kind: "refund" | "default";
};
