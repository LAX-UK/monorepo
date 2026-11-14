import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { LONDON_TIME_ZONE, formatDayMonth, formatWeekday, formatWhen } from "@auction/datetime";
import type { PurchaseInvoiceCard } from "@auction/types";
import type { PurchaseCardVm } from "./purchases.vm";

/** A download on the card: LAX's stored copy of the Books invoice, or LAX's own invoice. */
export type InvoiceCardLink = { label: string; href: string };

/** A credit note line: "Refunded −£123.45 to your card" (card only) and its download. */
export type InvoiceCardCredit = { text: string; download: InvoiceCardLink };

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
      /** Each refund's credit note, oldest first; empty when nothing was refunded. */
      credits: InvoiceCardCredit[];
    }
  | {
      kind: "cancelled";
      title: string;
      /** "This invoice was cancelled on Mon 16 Nov. You owe nothing on it." */
      detail: string;
      /** The credit note that cancels it after a default, once issued. */
      credits: InvoiceCardCredit[];
    }
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
  defaultedTitle: "Cancelled after a default",
  laxEmpty: "The invoice appears here once it is raised.",
  /** A default's credit note row: its number is the title, so the link says only what it does. */
  creditDownload: "Download (PDF)",
  refundedBadge: "Refunded",
  refundedNote: "Your payment has been refunded",
} as const;

/**
 * Where a refund went, by how the invoice was paid; nothing is said when that is not known. A card
 * payment is refunded to the card. A bank transfer is a Stripe balance payment, and LAX does not
 * choose where its refund goes (it is not confirmed that it reaches the buyer's bank account), so
 * no destination is named for it.
 */
const REFUNDED_TO: Readonly<Record<NonNullable<PurchaseInvoiceCard["paidWith"]>, string>> = {
  card: " to your card",
  bank_transfer: "",
};

const POUNDS = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/**
 * A refund: "Refunded −£123.45 to your card", and its download "Download credit note CN-00001
 * (PDF)". A default's credit note: "Credit note CN-00001", and "Download (PDF)" (the number once).
 */
function creditLine(
  lotId: string,
  credit: PurchaseInvoiceCard["creditNotes"][number],
  paidWith: PurchaseInvoiceCard["paidWith"],
): InvoiceCardCredit {
  const href = purchaseDocumentHref(lotId, credit.documentId);
  if (credit.kind === "refund") {
    return {
      text: `Refunded \u2212${POUNDS.format(credit.grossPence / 100)}${paidWith ? REFUNDED_TO[paidWith] : ""}`,
      download: { label: `Download credit note ${credit.number} (PDF)`, href },
    };
  }
  return {
    text: `Credit note ${credit.number}`,
    download: { label: INVOICE_CARD_COPY.creditDownload, href },
  };
}

/** The issued invoice's refund credit notes together credit all of it: the buyer was refunded in full. */
export function refundedInFull(card: PurchaseInvoiceCard | null): boolean {
  if (!card || card.state !== "issued" || card.totalPence <= 0) return false;
  const refunded = (card.creditNotes ?? [])
    .filter((c) => c.kind === "refund")
    .reduce((sum, c) => sum + c.grossPence, 0);
  return refunded >= card.totalPence;
}

/**
 * The purchase as the buyer reads it once Books' credit notes refund the whole invoice: the badge
 * and the Payment card say "Refunded", never "Paid" or "Total paid" beside the refunds. Anything
 * else (a part refund, no Books card) leaves it as it is.
 */
export function withBooksRefund(
  card: PurchaseCardVm,
  books: PurchaseInvoiceCard | null,
): PurchaseCardVm {
  if (card.state === "refunded" || !refundedInFull(books)) return card;
  return {
    ...card,
    badge: { label: INVOICE_CARD_COPY.refundedBadge, tone: "neutral", shape: "ring" },
    statusLabel: INVOICE_CARD_COPY.refundedBadge,
    statusNote: INVOICE_CARD_COPY.refundedNote,
    amountLabel: "refunded",
  };
}

/** Where a stored Books document downloads from, through the app (the member's session goes too). */
export function purchaseDocumentHref(lotId: string, documentId: string): string {
  return `${CLIENT_ROUTES.purchases}/${encodeURIComponent(lotId)}/documents/${encodeURIComponent(documentId)}`;
}

/** "Thu 12 Nov, 14:05 GMT": the shared moment style, in London (the invoice's own zone). */
function moment(iso: string, now: Date): string {
  return formatWhen(new Date(iso), LONDON_TIME_ZONE, now);
}

/** "Mon 16 Nov": the day only (the moment style's short form), in London. */
function day(iso: string, now: Date): string {
  const at = new Date(iso);
  return `${formatWeekday(at, LONDON_TIME_ZONE)} ${formatDayMonth(at, LONDON_TIME_ZONE, now)}`;
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
        credits: (card.creditNotes ?? [])
          .filter((c) => c.kind === "refund")
          .map((c) => creditLine(lotId, c, card.paidWith ?? null)),
      };
    }
    case "cancelled":
      return {
        kind: "cancelled",
        title: card.cancelledAfterDefault
          ? INVOICE_CARD_COPY.defaultedTitle
          : INVOICE_CARD_COPY.cancelledTitle,
        detail: card.cancelledAt
          ? `This invoice was cancelled on ${day(card.cancelledAt, now)}. You owe nothing on it.`
          : "This invoice was cancelled. You owe nothing on it.",
        credits: (card.creditNotes ?? []).map((c) => creditLine(lotId, c, card.paidWith ?? null)),
      };
    case "lax":
      return lax;
  }
}
