import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { LONDON_TIME_ZONE, formatWhen } from "@auction/datetime";
import type { PurchaseInvoiceCard } from "@auction/types";

/** A download on the card: LAX's stored copy of the Books invoice, or LAX's own invoice. */
export type InvoiceCardLink = { label: string; href: string };

/**
 * The invoice card on a Bid purchase, ready to draw. Each state's words are fixed here and
 * nowhere else; figures and dates are the API's (the invoice's frozen lines, Books' own dates).
 */
export type PurchaseInvoiceCardVm =
  | {
      kind: "preparing" | "delayed";
      title: string;
      detail: string;
      /** "PDF available once issued": there is nothing to download yet. */
      note: string;
      tone: "neutral" | "warning";
    }
  | {
      kind: "issued";
      title: string;
      /** "Issued Thu 12 Nov, 14:05 GMT". */
      meta: string;
      download: InvoiceCardLink;
    }
  | { kind: "cancelled"; title: string; detail: string }
  | {
      /** Books does not issue this invoice (yet): LAX's own invoice, as before. */
      kind: "lax";
      download: InvoiceCardLink | null;
      empty: string;
    };

export const INVOICE_CARD_COPY = {
  preparingTitle: "Invoice being prepared",
  preparingDetail: "You can pay now. We'll email your invoice as soon as it's ready.",
  pdfLater: "PDF available once issued",
  delayedDetail:
    "This is taking longer than usual. Our team has been told. Your payment is not affected.",
  download: "Download invoice (PDF)",
  cancelledTitle: "Invoice cancelled",
  laxEmpty: "The invoice appears here once it is raised.",
} as const;

/** Where a stored Books document downloads from, through the app (the member's session goes too). */
export function purchaseDocumentHref(lotId: string, documentId: string): string {
  return `${CLIENT_ROUTES.purchases}/${encodeURIComponent(lotId)}/documents/${encodeURIComponent(documentId)}`;
}

/** "Thu 12 Nov, 14:05 GMT": the shared moment style, in London (the invoice's own zone). */
function moment(iso: string, now: Date): string {
  return formatWhen(new Date(iso), LONDON_TIME_ZONE, now);
}

/**
 * The card for a purchase's invoice. With no Books card (it could not be read, or the member is
 * not the payer) it is LAX's own invoice, exactly as the page showed it before, so nothing is
 * lost when Books is off or only rehearsing.
 */
export function purchaseInvoiceCard(input: {
  lotId: string;
  card: PurchaseInvoiceCard | null;
  /** LAX's own invoice PDF, when the member may download it. */
  laxInvoiceHref: string | null;
  now: Date;
}): PurchaseInvoiceCardVm {
  const { card, lotId, now } = input;
  const lax: PurchaseInvoiceCardVm = {
    kind: "lax",
    download: input.laxInvoiceHref ? { label: "Invoice", href: input.laxInvoiceHref } : null,
    empty: INVOICE_CARD_COPY.laxEmpty,
  };
  if (!card) return lax;
  switch (card.state) {
    case "preparing":
    case "delayed":
      return {
        kind: card.state,
        title: INVOICE_CARD_COPY.preparingTitle,
        detail:
          card.state === "delayed"
            ? INVOICE_CARD_COPY.delayedDetail
            : INVOICE_CARD_COPY.preparingDetail,
        note: INVOICE_CARD_COPY.pdfLater,
        tone: card.state === "delayed" ? "warning" : "neutral",
      };
    case "issued": {
      // A Books number is only ever shown with its stored copy behind it.
      if (!card.invoiceNumber || !card.issuedAt || !card.invoiceDocumentId) return lax;
      return {
        kind: "issued",
        title: `Invoice ${card.invoiceNumber}`,
        meta: `Issued ${moment(card.issuedAt, now)}`,
        download: {
          label: INVOICE_CARD_COPY.download,
          href: purchaseDocumentHref(lotId, card.invoiceDocumentId),
        },
      };
    }
    case "cancelled":
      return {
        kind: "cancelled",
        title: INVOICE_CARD_COPY.cancelledTitle,
        detail: card.cancelledAt
          ? `This invoice was cancelled on ${moment(card.cancelledAt, now)}. You owe nothing on it.`
          : "This invoice was cancelled. You owe nothing on it.",
      };
    case "lax":
      return lax;
  }
}
