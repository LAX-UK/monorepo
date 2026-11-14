import { invoiceStandingOf } from "@auction/accounting-domain";
import type { ShopOrderInvoiceCard } from "@auction/shop-contracts";
import type { OrderRecord } from "./ports/commerce.ports.js";
import type {
  InvoiceCopyStorage,
  OrderInvoiceBooksDocument,
  OrderInvoiceBooksReader,
} from "./ports/order-invoice-books.port.js";

/** A stored copy is one Books PDF; anything larger is not served. */
const MAX_COPY_BYTES = 10 * 1024 * 1024;

/** Only these keys are LAX's stored copies of London Art Exchange's Books documents. */
const COPY_KEY = /^accounting\/london_art_exchange\/[0-9a-f-]{36}\.pdf$/;

type CardOrder = Pick<OrderRecord, "orderId" | "status" | "paidAt" | "refunds">;

export type OrderInvoicePdf = { pdf: Buffer; filename: string };

/**
 * When the order stopped owing its invoice: cancelled, or refunded in full (the latest refund
 * that went through). Null while it stands.
 */
export function orderCancelledAt(order: CardOrder): Date | null {
  if (order.status !== "cancelled" && order.status !== "refunded") return null;
  const refunded = order.refunds
    .filter((r) => r.status === "succeeded" && r.refundedAt)
    .map((r) => (r.refundedAt as Date).getTime());
  return refunded.length > 0 ? new Date(Math.max(...refunded)) : (order.paidAt ?? new Date(0));
}

/**
 * A document LAX may hand the buyer: issued live in the mode Books is aimed at now, with a stored
 * copy that is not a rehearsal, under London Art Exchange's copies. Never a dry run's or the test
 * organisation's, and never anything else in storage.
 */
export function servable(
  document: OrderInvoiceBooksDocument,
  booksMode: OrderInvoiceBooksDocument["targetMode"] | null,
): boolean {
  return (
    document.targetMode === booksMode &&
    document.targetMode === "live" &&
    document.state === "issued" &&
    document.providerNumber !== null &&
    document.copy !== null &&
    !document.copy.rehearsal &&
    COPY_KEY.test(document.copy.storageKey)
  );
}

/**
 * The buyer's invoice card on a paid Shop order, and LAX's stored copy behind its link. The
 * caller has already checked the order is the shopper's own. The card follows the Books mode the
 * switch aims the Shop at now: not aimed, only rehearsing, or the test organisation, and it is
 * LAX's own invoice as before (`lax`); a Books number and a download only once Books issued the
 * invoice live and LAX holds its copy. The buyer downloads that copy, never Books' own link.
 */
export function createOrderInvoiceCardService(deps: {
  books: OrderInvoiceBooksReader;
  /** Null where the document storage is not configured: nothing is ever served then. */
  storage: InvoiceCopyStorage | null;
  now: () => Date;
}) {
  return {
    async card(order: CardOrder): Promise<ShopOrderInvoiceCard> {
      const lax: ShopOrderInvoiceCard = {
        state: "lax",
        invoiceNumber: null,
        issuedAt: null,
        invoiceDocumentId: null,
        cancelledAt: null,
      };
      // An unpaid order has no invoice to speak of: the page is as it was.
      if (!order.paidAt) return lax;
      // Unreadable Books records never block the order page: the buyer keeps LAX's own invoice.
      const books = await deps.books.read(order.orderId).catch(() => null);
      if (!books) return lax;
      const document = books.documents.find((d) => d.targetMode === books.booksMode) ?? null;
      const cancelledAt = orderCancelledAt(order);
      const standing = invoiceStandingOf(
        {
          raisedAtMs: order.paidAt.getTime(),
          cancelledAtMs: cancelledAt?.getTime() ?? null,
          booksMode: books.booksMode,
          document: document
            ? {
                issuedNumber: document.state === "issued" ? document.providerNumber : null,
                copyStored: servable(document, books.booksMode),
              }
            : null,
        },
        deps.now().getTime(),
      );
      const issued = standing.kind === "issued" && document !== null;
      return {
        state: standing.kind,
        invoiceNumber: standing.kind === "issued" ? standing.number : null,
        // When Books issued it (the event log's time), never when the row last changed.
        issuedAt: issued ? (document.issuedAt?.toISOString() ?? null) : null,
        invoiceDocumentId: issued ? document.documentId : null,
        cancelledAt:
          standing.kind === "cancelled" ? new Date(standing.cancelledAtMs).toISOString() : null,
      };
    },

    /** LAX's stored copy of the order's invoice, or null (one answer for every reason). */
    async document(order: CardOrder, documentId: string): Promise<OrderInvoicePdf | null> {
      if (!order.paidAt || orderCancelledAt(order) !== null || !deps.storage) return null;
      const books = await deps.books.read(order.orderId).catch(() => null);
      if (!books) return null;
      // Only this order's own document: an id of anything else is the same "not found".
      const match = books.documents.find(
        (d) => d.documentId === documentId && servable(d, books.booksMode),
      );
      if (!match?.copy) return null;
      const pdf = await deps.storage.getObjectBytes(match.copy.storageKey, MAX_COPY_BYTES);
      if (!pdf || pdf.length === 0) return null;
      const safe = (match.providerNumber ?? "").replace(/[^A-Za-z0-9-]+/g, "-") || "document";
      return { pdf, filename: `invoice-${safe}.pdf` };
    },
  };
}

export type OrderInvoiceCardService = ReturnType<typeof createOrderInvoiceCardService>;
