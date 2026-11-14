import { buildInclusiveInvoice, buildPayment } from "../document.js";
import type { Pence } from "../money.js";
import { type Result, ok, refuse } from "../result.js";
import type { Projection, ProjectionCode, ProjectionPolicy } from "./projection.js";
import { type ShopBuyerFacts, shopContact, shopLine } from "./shop.js";

/**
 * An original artwork sold directly in LAX Shop and paid, read from the stored sale (flow 22).
 * Books issues its invoice (decision F17); Stripe took the payment. Dates are London calendar days.
 */
export interface ShopOriginalSalePaidFacts {
  readonly originalSaleId: string;
  /** The Shop's own invoice number ("LAX-INV-000125"), from the counter Shop orders use. */
  readonly invoiceNumber: string;
  readonly buyer: ShopBuyerFacts;
  readonly paidOn: string;
  /** What the invoice says: "Original artwork: Harbour at dusk". */
  readonly label: string;
  /** The stored sale price: what the buyer was asked for and Stripe took, VAT included. */
  readonly salePricePence: Pence;
  /** As stored on the sale: null and null when it was sold with no VAT recorded. */
  readonly vatTreatment: string | null;
  readonly vatPence: Pence | null;
}

/**
 * The source id of an original sale's documents: `original-<sale>`, so its references
 * (`LAX-SHOP-INV-original-<sale>`, `LAX-SHOP-PAY-original-<sale>`) can never be an order's.
 */
export function shopOriginalSaleSourceId(originalSaleId: string): string {
  return `original-${originalSaleId.toLowerCase()}`;
}

/** The original sale behind a Shop source id, or null when the source id is not an original's. */
export function shopOriginalSaleIdOf(sourceId: string): string | null {
  return /^original-([0-9a-f-]{36})$/.exec(sourceId)?.[1] ?? null;
}

/**
 * Shop original sold: the buyer's contact (the same contact their Shop orders use), the invoice
 * under the Shop's own `LAX-INV-` number with the one original on it, booked with the VAT stored on
 * the sale exactly as a Shop order line is (`shopLine`: standard with its stored VAT, no VAT
 * recorded as charged with none, anything else refused), then the customer payment of the whole
 * price into the Stripe clearing account, applied to that invoice in full. Issued, due and paid
 * the day Stripe took the payment: the invoice is issued once the original is paid for.
 */
export const projectShopOriginalSalePaid: ProjectionPolicy<ShopOriginalSalePaidFacts> = (
  facts,
): Result<Projection, ProjectionCode> => {
  if (facts.salePricePence <= 0) {
    return refuse("bad_amount", "an original sold for nothing has nothing to invoice");
  }
  const contact = shopContact(facts.buyer);
  if (!contact.ok) return contact;
  const line = shopLine(
    facts.label,
    "goods",
    facts.salePricePence,
    facts.vatTreatment,
    facts.vatPence,
  );
  if (!line.ok) return line;
  const sourceId = shopOriginalSaleSourceId(facts.originalSaleId);
  const invoice = buildInclusiveInvoice({
    product: "shop",
    sourceId,
    contactReference: contact.value.reference,
    issuedOn: facts.paidOn,
    dueOn: facts.paidOn,
    number: facts.invoiceNumber,
    lines: [line.value],
  });
  if (!invoice.ok) return invoice;
  const payment = buildPayment({
    product: "shop",
    sourceId,
    contactReference: contact.value.reference,
    receivedOn: facts.paidOn,
    amountPence: facts.salePricePence,
    // What Stripe took is exactly the invoice: nothing is left over as the buyer's credit.
    allocations: [{ invoiceReference: invoice.value.reference, amountPence: facts.salePricePence }],
  });
  if (!payment.ok) return payment;
  return ok({ documents: [contact.value, invoice.value, payment.value], parked: [] });
};
