import {
  type Contact,
  type InclusiveLineInput,
  type Invoice,
  buildContact,
  buildInclusiveInvoice,
  buildPayment,
} from "../document.js";
import { type Pence, isPence } from "../money.js";
import { type Result, ok, refuse } from "../result.js";
import type { ParkedDocument, Projection, ProjectionCode, ProjectionPolicy } from "./projection.js";

/** The buyer a Shop order is invoiced to: one Books contact per Shop buyer party. */
export interface ShopBuyerFacts {
  /** The buyer's Shop party id: the contact's source id, so one buyer is one contact. */
  readonly partyId: string;
  readonly name: string;
  readonly email: string | null;
}

/**
 * One stored Shop order line as it was sold: the VAT-inclusive price and the VAT stored with it.
 * A framing line carries the frame's price as staff set it and as it was frozen on the order.
 */
export interface ShopOrderLineFacts {
  /** The stored line's id, so a reader can check these are the lines the event named. */
  readonly id: string;
  readonly kind: "goods" | "framing";
  /** What the invoice says: "Harbour at dusk, Edition 7 of 24" or "Framing: Oak, white mount". */
  readonly label: string;
  readonly grossPence: Pence;
  /** "standard" when VAT was recorded; null when the order was sold without a VAT policy. */
  readonly vatTreatment: string | null;
  readonly vatPence: Pence | null;
}

/**
 * How the order reaches the buyer, priced as stored on the order (`fulfilment_surcharge_pence`,
 * `fulfilment_vat_pence`). `uk` covers UK delivery and every collection; `outside_uk` is a
 * delivery quote, whose VAT waits for the accountant.
 */
export interface ShopDeliveryFacts {
  readonly scope: "uk" | "outside_uk";
  readonly label: string;
  readonly grossPence: Pence;
  readonly vatPence: Pence | null;
}

/** A paid Shop order, read from its stored rows. Dates are London calendar days. */
export interface ShopOrderPaidFacts {
  readonly orderId: string;
  /** The Shop's own invoice number ("LAX-INV-000124"), given when the order was paid. */
  readonly invoiceNumber: string;
  readonly buyer: ShopBuyerFacts;
  readonly paidOn: string;
  /** The order's stored total; the lines and delivery must add up to it exactly. */
  readonly totalPence: Pence;
  readonly lines: readonly ShopOrderLineFacts[];
  readonly delivery: ShopDeliveryFacts;
}

/** Shop orders are paid at checkout; the invoice is due the day it is issued. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * The source id of the parked outside-UK delivery invoice: the order id with `-delivery`, so it is
 * its own reference (`LAX-SHOP-INV-<order>-delivery`) and never the order invoice's.
 */
export function shopOutsideUkDeliverySourceId(orderId: string): string {
  return `${orderId}-delivery`;
}

function shopContact(buyer: ShopBuyerFacts): Result<Contact, ProjectionCode> {
  const email = typeof buyer.email === "string" && EMAIL.test(buyer.email) ? buyer.email : null;
  return buildContact({ product: "shop", sourceId: buyer.partyId, name: buyer.name, email });
}

/** A stored line as booked: standard-rated with its stored VAT, or refused, never guessed. */
function shopLine(
  label: string,
  role: "goods" | "delivery",
  grossPence: Pence,
  vatTreatment: string | null,
  vatPence: Pence | null,
): Result<InclusiveLineInput, ProjectionCode> {
  if (!isPence(grossPence) || grossPence < 0) {
    return refuse("bad_amount", `${label}: the stored price is not whole pence`);
  }
  if (vatTreatment !== "standard" || vatPence === null) {
    return refuse("unmapped_line", `${label}: no VAT was recorded when it was sold`);
  }
  return ok({ description: label, grossPence, vatPence, treatment: "standard", role });
}

function goodsLines(facts: ShopOrderPaidFacts): Result<InclusiveLineInput[], ProjectionCode> {
  const out: InclusiveLineInput[] = [];
  for (const line of facts.lines) {
    // A line of nothing (a free print) says nothing in the books.
    if (line.grossPence === 0) continue;
    const built = shopLine(line.label, "goods", line.grossPence, line.vatTreatment, line.vatPence);
    if (!built.ok) return built;
    out.push(built.value);
  }
  return ok(out);
}

interface ShopDocuments {
  readonly contact: Contact;
  readonly invoice: Invoice;
  /** The outside-UK delivery, invoiced on its own and parked; null for a UK order. */
  readonly parkedDelivery: Invoice | null;
}

function shopDocuments(facts: ShopOrderPaidFacts): Result<ShopDocuments, ProjectionCode> {
  const contact = shopContact(facts.buyer);
  if (!contact.ok) return contact;
  const goods = goodsLines(facts);
  if (!goods.ok) return goods;
  const { delivery } = facts;
  const deliveryLine =
    delivery.grossPence === 0
      ? null
      : shopLine(delivery.label, "delivery", delivery.grossPence, "standard", delivery.vatPence);
  if (deliveryLine && !deliveryLine.ok) return deliveryLine;

  const charged = facts.lines.reduce((sum, line) => sum + line.grossPence, 0) + delivery.grossPence;
  if (!isPence(facts.totalPence) || charged !== facts.totalPence) {
    return refuse(
      "bad_facts",
      `the order's lines add up to ${charged}p, not its ${facts.totalPence}p`,
    );
  }

  // UK delivery is a line on the order's invoice. Delivery outside the UK never is: its VAT waits
  // for the accountant, so it is invoiced on its own and parked, never sent.
  const onInvoice = [...goods.value];
  if (deliveryLine?.ok && delivery.scope === "uk") onInvoice.push(deliveryLine.value);
  const common = {
    product: "shop" as const,
    contactReference: contact.value.reference,
    issuedOn: facts.paidOn,
    dueOn: facts.paidOn,
  };
  const invoice = buildInclusiveInvoice({
    ...common,
    sourceId: facts.orderId,
    number: facts.invoiceNumber,
    lines: onInvoice,
  });
  if (!invoice.ok) return invoice;
  let parkedDelivery: Invoice | null = null;
  if (deliveryLine?.ok && delivery.scope === "outside_uk") {
    const parked = buildInclusiveInvoice({
      ...common,
      sourceId: shopOutsideUkDeliverySourceId(facts.orderId),
      // Never sent while parked. Its own number beside the order's, so the two can never clash.
      number: `${facts.invoiceNumber}-D`,
      lines: [deliveryLine.value],
    });
    if (!parked.ok) return parked;
    parkedDelivery = parked.value;
  }
  return ok({ contact: contact.value, invoice: invoice.value, parkedDelivery });
}

/**
 * Shop order paid: the buyer's contact, the order's invoice under the Shop's own number (goods,
 * framing, and UK delivery, each from its stored line), then the customer payment of the whole
 * order into the Stripe clearing account, applied to that invoice.
 *
 * Delivery outside the UK is a quote whose VAT the accountant has not confirmed. It is invoiced on
 * its own and parked (`vat_on_outside_uk_delivery`), so it sits in "Needs a person" and is never
 * sent. The payment still books every penny the buyer paid; what the parked delivery accounts for
 * is left unapplied (held as the buyer's credit), never spread over the goods.
 */
export const projectShopOrderPaid: ProjectionPolicy<ShopOrderPaidFacts> = (facts) => {
  const built = shopDocuments(facts);
  if (!built.ok) return built;
  const { contact, invoice, parkedDelivery } = built.value;
  const paid = invoice.totals.grossPence;
  const payment = buildPayment({
    product: "shop",
    sourceId: facts.orderId,
    contactReference: contact.reference,
    receivedOn: facts.paidOn,
    amountPence: facts.totalPence,
    allocations: [{ invoiceReference: invoice.reference, amountPence: paid }],
  });
  if (!payment.ok) return payment;
  if (payment.value.unallocatedPence !== (parkedDelivery?.totals.grossPence ?? 0)) {
    return refuse("bad_facts", "the payment's unapplied rest is not the parked delivery");
  }
  const parked: ParkedDocument[] = parkedDelivery
    ? [{ reference: parkedDelivery.reference, reason: "vat_on_outside_uk_delivery" }]
    : [];
  const documents: Projection["documents"] = parkedDelivery
    ? [contact, invoice, parkedDelivery, payment.value]
    : [contact, invoice, payment.value];
  return ok({ documents, parked });
};
