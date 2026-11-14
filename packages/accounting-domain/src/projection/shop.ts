import {
  type Contact,
  type InclusiveLineInput,
  type Invoice,
  buildContact,
  buildInclusiveInvoice,
  buildPayment,
  laxReference,
  parseLaxReference,
} from "../document.js";
import { type Pence, isPence } from "../money.js";
import { type Result, ok, refuse } from "../result.js";
import type { LineBooking } from "./bid.js";
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

/**
 * How a Shop delivery outside the UK is booked, once the accountant has said. Null until then: the
 * delivery invoice is stored parked (`vat_on_outside_uk_delivery`) and never sent. LAX does not
 * guess a VAT treatment; setting this is an engineering change made on the accountant's written
 * answer, and parked documents are then released by a person (see the runbook). A `standard`
 * booking needs the VAT stored on the order: what the buyer paid is never split again here.
 */
export const SHOP_OUTSIDE_UK_DELIVERY_BOOKING: LineBooking | null = null;

/** Shop orders are paid at checkout; the invoice is due the day it is issued. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * The source id of the parked outside-UK delivery invoice: the order id with `-delivery`, so it is
 * its own reference (`LAX-SHOP-INV-<order>-delivery`) and never the order invoice's.
 */
export function shopOutsideUkDeliverySourceId(orderId: string): string {
  return `${orderId}-delivery`;
}

/**
 * The Shop order payment whose unapplied rest pays an outside-UK delivery invoice, by the
 * invoice's LAX reference (`LAX-SHOP-INV-<order>-delivery` -> `LAX-SHOP-PAY-<order>`). Null for
 * any other reference: only those invoices are paid from a payment booked before them.
 */
export function shopDeliveryPaymentReference(invoiceReference: string): string | null {
  const parsed = parseLaxReference(invoiceReference);
  if (!parsed.ok || parsed.value.product !== "shop" || parsed.value.kind !== "invoice") return null;
  const match = /^(.+)-delivery$/.exec(parsed.value.sourceId);
  if (!match?.[1]) return null;
  const reference = laxReference("shop", "payment", match[1]);
  return reference.ok ? reference.value : null;
}

function shopContact(buyer: ShopBuyerFacts): Result<Contact, ProjectionCode> {
  const email = typeof buyer.email === "string" && EMAIL.test(buyer.email) ? buyer.email : null;
  return buildContact({ product: "shop", sourceId: buyer.partyId, name: buyer.name, email });
}

/**
 * A stored line as booked, with the VAT it was sold with and nothing worked out again:
 * - `standard` with its stored VAT;
 * - no VAT recorded (the Shop sold it with no VAT policy, so the buyer was charged none): booked
 *   with no VAT (`outside_scope`), exactly what the buyer paid;
 * - anything else (a treatment LAX has no booking for) is refused, never guessed.
 * Whether the organisation may take VAT at all is the adapter's rule: a VAT line sent to an
 * organisation that is not VAT registered is refused there and waits for a person.
 */
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
  if (vatTreatment === null && vatPence === null) {
    return ok({ description: label, grossPence, vatPence: 0, treatment: "outside_scope", role });
  }
  if (vatTreatment !== "standard" || vatPence === null) {
    return refuse(
      "unmapped_line",
      `${label}: no booking for VAT treatment ${String(vatTreatment)}`,
    );
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
  /** The outside-UK delivery, invoiced on its own; null for a UK order. */
  readonly outsideUkDelivery: Invoice | null;
}

/**
 * The outside-UK delivery line as booked. Without a booking it is the draft: the gross the buyer
 * paid with no VAT stated (`outside_scope`), parked and never sent. With one, the accountant's
 * treatment, over the same gross: a VAT-bearing treatment takes the VAT stored on the order and is
 * refused when none was stored (it is never worked out again).
 */
function outsideUkLine(
  line: InclusiveLineInput,
  storedVatPence: Pence | null,
  booking: LineBooking | null,
): Result<InclusiveLineInput, ProjectionCode> {
  if (booking === null) return ok({ ...line, vatPence: 0, treatment: "outside_scope" });
  if (booking.treatment === "standard") {
    if (storedVatPence === null) {
      return refuse(
        "line_awaiting_accountant",
        `${line.description}: the booking takes VAT, but none was stored on the order`,
      );
    }
    return ok({ ...line, vatPence: storedVatPence, treatment: "standard", role: booking.role });
  }
  return ok({ ...line, vatPence: 0, treatment: booking.treatment, role: booking.role });
}

/** The delivery's line as stored on the order; null when it charged nothing. */
function shopDeliveryLine(
  delivery: ShopDeliveryFacts,
): Result<InclusiveLineInput, ProjectionCode> | null {
  if (delivery.grossPence === 0) return null;
  return shopLine(
    delivery.label,
    "delivery",
    delivery.grossPence,
    delivery.vatPence === null ? null : "standard",
    delivery.vatPence,
  );
}

/** What an outside-UK delivery invoice is issued as, beside the order's own invoice. */
interface DeliveryInvoiceHeader {
  readonly orderId: string;
  readonly contactReference: string;
  readonly issuedOn: string;
  readonly dueOn: string;
  readonly number: string;
}

/**
 * The outside-UK delivery invoice (`LAX-SHOP-INV-<order>-delivery`). LAX states no VAT on
 * delivery outside the UK: what it is, if anything, is the accountant's answer (`booking`); until
 * then the line is the gross the buyer paid, with no VAT, and the invoice is parked, never sent.
 * The projection and a release both build it here, so the two always agree.
 */
function outsideUkDeliveryInvoice(
  header: DeliveryInvoiceHeader,
  line: InclusiveLineInput,
  storedVatPence: Pence | null,
  booking: LineBooking | null,
): Result<Invoice, ProjectionCode> {
  const quote = outsideUkLine(line, storedVatPence, booking);
  if (!quote.ok) return quote;
  return buildInclusiveInvoice({
    product: "shop",
    sourceId: shopOutsideUkDeliverySourceId(header.orderId),
    contactReference: header.contactReference,
    issuedOn: header.issuedOn,
    dueOn: header.dueOn,
    number: header.number,
    lines: [quote.value],
  });
}

/**
 * A parked outside-UK delivery invoice rebuilt for release from what the Shop stores now: the
 * order's delivery (`ShopDeliveryFacts`, read from the order row), with `booking`. Its header (the
 * buyer's contact, the days and its number) is the parked draft's own, which the projection took
 * from the same order. The projection it returns holds that one invoice, parked while there is no
 * booking, so `resolveParked` decides exactly as for any parked document. Refused when the order no
 * longer charges an outside-UK delivery, or charges another amount than the draft.
 */
export function rebuildShopOutsideUkDelivery(
  draft: Invoice,
  delivery: ShopDeliveryFacts,
  booking: LineBooking | null,
): Result<Projection, ProjectionCode> {
  const parsed = parseLaxReference(draft.reference);
  const orderId = parsed.ok ? /^(.+)-delivery$/.exec(parsed.value.sourceId)?.[1] : undefined;
  if (!orderId || draft.product !== "shop" || !draft.number) {
    return refuse("bad_facts", "not a Shop outside-UK delivery invoice");
  }
  if (delivery.scope !== "outside_uk" || delivery.grossPence !== draft.totals.grossPence) {
    return refuse("bad_facts", "the order no longer charges this delivery outside the UK");
  }
  const line = shopDeliveryLine(delivery);
  if (!line) return refuse("bad_facts", "the order charges nothing for delivery");
  if (!line.ok) return line;
  const built = outsideUkDeliveryInvoice(
    {
      orderId,
      contactReference: draft.contactReference,
      issuedOn: draft.issuedOn,
      dueOn: draft.dueOn,
      number: draft.number,
    },
    line.value,
    delivery.vatPence,
    booking,
  );
  if (!built.ok) return built;
  const parked: ParkedDocument[] =
    booking === null
      ? [{ reference: built.value.reference, reason: "vat_on_outside_uk_delivery" }]
      : [];
  return ok({ documents: [built.value], parked });
}

function shopDocuments(
  facts: ShopOrderPaidFacts,
  booking: LineBooking | null,
): Result<ShopDocuments, ProjectionCode> {
  const contact = shopContact(facts.buyer);
  if (!contact.ok) return contact;
  const goods = goodsLines(facts);
  if (!goods.ok) return goods;
  const { delivery } = facts;
  const deliveryLine = shopDeliveryLine(delivery);
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
  let outsideUkDelivery: Invoice | null = null;
  if (deliveryLine?.ok && delivery.scope === "outside_uk") {
    const built = outsideUkDeliveryInvoice(
      {
        orderId: facts.orderId,
        contactReference: contact.value.reference,
        issuedOn: facts.paidOn,
        dueOn: facts.paidOn,
        // Its own number beside the order's, so the two can never clash.
        number: `${facts.invoiceNumber}-D`,
      },
      deliveryLine.value,
      delivery.vatPence,
      booking,
    );
    if (!built.ok) return built;
    outsideUkDelivery = built.value;
  }
  return ok({ contact: contact.value, invoice: invoice.value, outsideUkDelivery });
}

/**
 * The Shop order paid policy with outside-UK delivery booked as `booking` says (parked while it
 * is null). Release rebuilds a parked delivery with the same policy, so both agree.
 *
 * Shop order paid: the buyer's contact, the order's invoice under the Shop's own number (goods,
 * framing, and UK delivery, each from its stored line), then the customer payment of the whole
 * order into the Stripe clearing account, applied to that invoice.
 *
 * Delivery outside the UK is a quote whose VAT the accountant has not confirmed. It is invoiced on
 * its own and parked (`vat_on_outside_uk_delivery`), so it sits in "Needs a person" and is never
 * sent. The payment still books every penny the buyer paid; what the parked delivery accounts for
 * is left unapplied (held as the buyer's credit), never spread over the goods.
 */
export function shopOrderPaidPolicy(
  booking: LineBooking | null,
): ProjectionPolicy<ShopOrderPaidFacts> {
  return (facts) => projectOrder(facts, booking);
}

/** The policy in force: outside-UK delivery parked until `SHOP_OUTSIDE_UK_DELIVERY_BOOKING` is set. */
export const projectShopOrderPaid: ProjectionPolicy<ShopOrderPaidFacts> = shopOrderPaidPolicy(
  SHOP_OUTSIDE_UK_DELIVERY_BOOKING,
);

function projectOrder(
  facts: ShopOrderPaidFacts,
  booking: LineBooking | null,
): Result<Projection, ProjectionCode> {
  const built = shopDocuments(facts, booking);
  if (!built.ok) return built;
  const { contact, invoice, outsideUkDelivery } = built.value;
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
  if (payment.value.unallocatedPence !== (outsideUkDelivery?.totals.grossPence ?? 0)) {
    return refuse("bad_facts", "the payment's unapplied rest is not the outside-UK delivery");
  }
  // The payment is applied to the goods invoice only, whether or not the delivery is booked yet,
  // so it is the same payment before and after the accountant's answer. Its rest is applied to
  // the delivery invoice once that is issued (`shopDeliveryRemainder`).
  const parked: ParkedDocument[] =
    outsideUkDelivery && booking === null
      ? [{ reference: outsideUkDelivery.reference, reason: "vat_on_outside_uk_delivery" }]
      : [];
  const documents: Projection["documents"] = outsideUkDelivery
    ? [contact, invoice, outsideUkDelivery, payment.value]
    : [contact, invoice, payment.value];
  return ok({ documents, parked });
}
