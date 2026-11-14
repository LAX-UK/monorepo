import { LONDON_TIME_ZONE, formatWhen } from "@auction/datetime";
import { type TemplateVarsByName, formatMoneyMajor } from "@auction/email";
import type { ShopInvoiceEmailFacts } from "@auction/persistence/interfaces";
import { invoicePdfFilename } from "./bid-invoice-email.js";

export type ShopInvoiceEmailVars = TemplateVarsByName["shop-invoice-issued"];

/** SHOP_STOREFRONT_URL is missing, or names a local address, while Shop invoices go out live. */
export class ShopStorefrontUrlError extends Error {
  override readonly name = "ShopStorefrontUrlError";
  constructor(why: string) {
    super(
      `SHOP_STOREFRONT_URL ${why}: set it to the Shop's public https address before Books issues Shop invoices live. No Shop invoice email is sent until then.`,
    );
  }
}

const LOCAL_HOST = /^(localhost|.*\.localhost|.*\.local|127(\.\d+){3}|0\.0\.0\.0|\[::1?\])$/i;

/**
 * The storefront address a live Shop invoice email links to. There is no default: unset, not
 * https, or a local address (localhost, a loopback, `.local`) is refused, so a forgotten setting
 * stops the Shop's emails rather than sending every buyer a link to nowhere.
 */
export function shopStorefrontBase(value: string | undefined): string {
  if (value === undefined || value.trim() === "") throw new ShopStorefrontUrlError("is not set");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ShopStorefrontUrlError("is not a URL");
  }
  if (url.protocol !== "https:") throw new ShopStorefrontUrlError("is not https");
  if (LOCAL_HOST.test(url.hostname)) throw new ShopStorefrontUrlError("names a local address");
  return url.origin + url.pathname.replace(/\/$/, "");
}

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
 * the order, the attached invoice's own total (its stored gross, never worked out again: for an
 * order with a delivery outside the UK that is less than the order's total, as the delivery is
 * invoiced on its own) and when it was paid, in the shared moment style ("Thu 12 Nov, 14:05 GMT",
 * London). Pure; the caller reads the facts and the time.
 */
export function composeShopInvoiceEmail(input: {
  readonly number: string;
  readonly facts: ShopInvoiceEmailFacts;
  /** The attached invoice's gross as stored. */
  readonly invoiceGrossPence: number;
  readonly storageKey: string;
  readonly storefrontUrl: string;
  readonly now: Date;
}): ShopInvoiceEmailVars {
  const { facts, now } = input;
  const total = formatMoneyMajor((input.invoiceGrossPence / 100).toFixed(2), "GBP");
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
