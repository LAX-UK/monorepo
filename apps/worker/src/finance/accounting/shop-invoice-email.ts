import { LONDON_TIME_ZONE, formatWhen } from "@auction/datetime";
import { type TemplateVarsByName, formatMoneyMajor } from "@auction/email";
import type { ShopInvoiceEmailFacts } from "@auction/persistence/interfaces";
import { invoicePdfFilename } from "./bid-invoice-email.js";

export type ShopInvoiceEmailVars = TemplateVarsByName["shop-invoice-issued"];

/**
 * Where the email's button takes the buyer: their order in their account, or, for a guest (who
 * has no account to open it from), the page that sends them a fresh link to it.
 */
export function shopOrderUrl(storefrontUrl: string, facts: ShopInvoiceEmailFacts): string {
  const base = storefrontUrl.replace(/\/$/, "");
  return facts.guest
    ? `${base}/orders/guest`
    : `${base}/account/orders/${encodeURIComponent(facts.orderId)}`;
}

/**
 * The "Your invoice" email for one issued Shop invoice: the Shop's own number (which Books keeps),
 * the order, its stored total (never worked out again) and when it was paid, in the shared moment
 * style ("Thu 12 Nov, 14:05 GMT", London). Pure; the caller reads the facts and the time.
 */
export function composeShopInvoiceEmail(input: {
  readonly number: string;
  readonly facts: ShopInvoiceEmailFacts;
  readonly storageKey: string;
  readonly storefrontUrl: string;
  readonly now: Date;
}): ShopInvoiceEmailVars {
  const { facts, now } = input;
  const total = formatMoneyMajor((facts.totalPence / 100).toFixed(2), "GBP");
  if (total === null) throw new Error("shop_invoice_email_bad_total");
  return {
    userName: facts.recipient?.name ?? null,
    invoiceNumber: input.number,
    orderReference: facts.orderReference,
    total,
    paidOn: formatWhen(facts.paidAt, LONDON_TIME_ZONE, now),
    storedAttachment: {
      storageKey: input.storageKey,
      filename: invoicePdfFilename(input.number),
      contentType: "application/pdf",
    },
    orderUrl: shopOrderUrl(input.storefrontUrl, facts),
  };
}
