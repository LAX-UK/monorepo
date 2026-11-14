import { shopOrderHref } from "@/lib/account/shop-account-routes";
import { LONDON_TIME_ZONE, formatDayMonth, formatWeekday, formatWhen } from "@auction/datetime";
import type { ShopOrderInvoiceCard } from "@auction/shop-contracts";

/**
 * The invoice card on a paid Shop order, ready to draw. The same states and approved words as the
 * Bid card; figures and dates are the API's (Books' issue event, the order's own refund).
 * `lax`: Books does not issue this invoice (yet), so the order page is exactly as it was, with
 * LAX's own invoice in "Help with this order".
 */
export type ShopOrderInvoiceCardVm =
  | { kind: "lax" }
  | {
      kind: "preparing" | "delayed";
      title: string;
      detail: string;
      /** "PDF available once issued": there is nothing to download yet. */
      note: string;
    }
  | {
      kind: "issued";
      title: string;
      /** "Issued Thu 12 Nov, 14:05 GMT". */
      meta: string;
      download: { label: string; href: string };
    }
  | {
      kind: "cancelled";
      title: string;
      /** "This invoice was cancelled on Mon 16 Nov. You owe nothing on it." */
      detail: string;
    };

/**
 * The approved words, as on the Bid card. A Shop order is paid before its invoice exists, so the
 * "being prepared" line keeps only its second sentence ("You can pay now." is the Bid card's).
 */
export const SHOP_INVOICE_CARD_COPY = {
  preparingTitle: "Invoice being prepared",
  preparingDetail: "We'll email your invoice as soon as it's ready.",
  pdfLater: "PDF available once issued",
  delayedDetail:
    "This is taking longer than usual. Our team has been told. Your payment is not affected.",
  download: "Download invoice (PDF)",
  cancelledTitle: "Invoice cancelled",
} as const;

/** Where LAX's stored copy downloads from, through the storefront (the session goes too). */
export function shopOrderDocumentHref(orderId: string, documentId: string): string {
  return `${shopOrderHref(orderId)}/documents/${encodeURIComponent(documentId)}`;
}

/** "Thu 12 Nov, 14:05 GMT": the shared moment style, in London (the invoice's own zone). */
function moment(iso: string, now: Date): string {
  return formatWhen(new Date(iso), LONDON_TIME_ZONE, now);
}

/** "Mon 16 Nov": the day only, in London (the year when it is not this one). */
function day(iso: string, now: Date): string {
  const at = new Date(iso);
  return `${formatWeekday(at, LONDON_TIME_ZONE)} ${formatDayMonth(at, LONDON_TIME_ZONE, now)}`;
}

export function shopOrderInvoiceCard(input: {
  orderId: string;
  card: ShopOrderInvoiceCard | null;
  now: Date;
}): ShopOrderInvoiceCardVm {
  const { card, now } = input;
  if (!card) return { kind: "lax" };
  switch (card.state) {
    case "preparing":
    case "delayed":
      return {
        kind: card.state,
        title: SHOP_INVOICE_CARD_COPY.preparingTitle,
        detail:
          card.state === "delayed"
            ? SHOP_INVOICE_CARD_COPY.delayedDetail
            : SHOP_INVOICE_CARD_COPY.preparingDetail,
        note: SHOP_INVOICE_CARD_COPY.pdfLater,
      };
    case "issued":
      // A number is only ever shown with LAX's stored copy behind it.
      if (!card.invoiceNumber || !card.issuedAt || !card.invoiceDocumentId) return { kind: "lax" };
      return {
        kind: "issued",
        title: `Invoice ${card.invoiceNumber}`,
        meta: `Issued ${moment(card.issuedAt, now)}`,
        download: {
          label: SHOP_INVOICE_CARD_COPY.download,
          href: shopOrderDocumentHref(input.orderId, card.invoiceDocumentId),
        },
      };
    case "cancelled":
      return {
        kind: "cancelled",
        title: SHOP_INVOICE_CARD_COPY.cancelledTitle,
        detail: card.cancelledAt
          ? `This invoice was cancelled on ${day(card.cancelledAt, now)}. You owe nothing on it.`
          : "This invoice was cancelled. You owe nothing on it.",
      };
    case "lax":
      return { kind: "lax" };
  }
}
