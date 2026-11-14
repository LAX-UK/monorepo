import { type Allocation, checkExactAllocations } from "../allocation.js";
import {
  type AccountingDocument,
  type Contact,
  type Invoice,
  buildInvoice,
  buildPayment,
  laxReference,
} from "../document.js";
import { CURRENCY, type Pence, isPence } from "../money.js";
import type { ParkReason } from "../parking.js";
import { type Result, ok, refuse } from "../result.js";
import {
  type BidBuyerFacts,
  type BidInvoiceFacts,
  type LineBooking,
  bidContact,
  bidInvoice,
} from "./bid.js";
import type { ParkedDocument, Projection, ProjectionCode, ProjectionPolicy } from "./projection.js";

/**
 * A Bid invoice that was cancelled (voided) after the money for it was taken. Only who it was for
 * is read: it is not booked again, and the payment for it is parked for a person.
 */
export interface BidCancelledInvoiceFacts {
  readonly invoiceId: string;
  readonly buyer: BidBuyerFacts;
  readonly cancelled: true;
}

/** The invoice a payment is for, as it stands now: raised (and bookable), or cancelled. */
export type BidPaidInvoiceFacts = BidInvoiceFacts | BidCancelledInvoiceFacts;

function isCancelled(invoice: BidPaidInvoiceFacts): invoice is BidCancelledInvoiceFacts {
  return "cancelled" in invoice && invoice.cancelled === true;
}

/**
 * A captured card or bank-transfer payment of one Bid invoice (a bank transfer only once the whole
 * amount arrived and was applied). The amount and currency are the stored payment row's.
 */
export interface BidPaymentFacts {
  readonly paymentId: string;
  readonly invoice: BidPaidInvoiceFacts;
  readonly amountPence: Pence;
  readonly currency: string;
  readonly capturedOn: string;
}

/** One invoice settled by a "Pay several" payment: its own payment row's amount. */
export interface BidGroupMemberFacts {
  readonly paymentId: string;
  readonly amountPence: Pence;
  readonly invoice: BidPaidInvoiceFacts;
}

/** A courier quote charged in a "Pay several" payment (a `payment_group_delivery` row). */
export interface BidGroupDeliveryFacts {
  /** The courier quote's id (charged once, for good): the delivery invoice's source. */
  readonly quoteId: string;
  readonly amountPence: Pence;
}

/**
 * One "Pay several" payment, once settled: one charge for several invoices of one buyer account,
 * and any courier quotes paid with them. Every amount is a stored row's (the group's total, each
 * member's payment, each quote's charge); none is worked out again.
 */
export interface BidPaymentGroupFacts {
  readonly groupId: string;
  readonly buyer: BidBuyerFacts;
  readonly currency: string;
  /** What the one charge took: the group's stored total. */
  readonly totalPence: Pence;
  /** The London day the group was settled. */
  readonly settledOn: string;
  readonly members: readonly BidGroupMemberFacts[];
  readonly deliveries: readonly BidGroupDeliveryFacts[];
}

/**
 * How a courier delivery charged with the lots is booked. NOT SET: whether delivery carries VAT
 * (and whether the charged price includes it) is the accountant's question. Until it is answered
 * this stays null, and every delivery invoice is built as a draft and parked
 * (`vat_on_delivery`), with the "Pay several" payment that is applied to it.
 *
 * Extension point: once the accountant confirms, set the role and treatment here (a VAT-inclusive
 * price needs a tax-inclusive line, so `deliveryInvoice` changes with it). Drafts parked before
 * then are not cancelled or projected again: staff press Release on each in Accounting. The
 * release rebuilds the delivery invoice from the stored rows with this booking (what was charged
 * must stay the same), replaces the draft under the same LAX reference and queues it; then the
 * payment is released and is sent once its invoices are in Books (`resolveParked`).
 */
export const DELIVERY_BOOKING: LineBooking | null = null;

/**
 * The parked draft's line, so the invoice carries exactly what was charged. Never sent: a draft
 * exists only while `DELIVERY_BOOKING` is null, and it is always parked.
 */
const DELIVERY_DRAFT: LineBooking = { role: "delivery", treatment: "outside_scope" };

/** Source ids for documents a "Pay several" payment makes, kept apart from row ids by a prefix. */
const GROUP_PAYMENT_PREFIX = "grp-";
const DELIVERY_INVOICE_PREFIX = "dlv-";

/** The LAX reference of the invoice with this id (a cancelled one is never built, only named). */
function invoiceReference(invoiceId: string): Result<string, ProjectionCode> {
  const reference = laxReference("bid", "invoice", invoiceId);
  return reference.ok ? reference : refuse("bad_source_id", reference.refusal.message);
}

/**
 * The invoice a payment is applied to, ready to book: its documents (none for a cancelled one,
 * which only gets named) and its reference. A raised invoice must belong to `buyer` and may not be
 * paid more than its total.
 */
function paidInvoice(
  invoice: BidPaidInvoiceFacts,
  buyer: BidBuyerFacts,
  amountPence: Pence,
): Result<{ reference: string; invoice: Invoice | null; cancelled: boolean }, ProjectionCode> {
  if (invoice.buyer.legalEntityId !== buyer.legalEntityId) {
    return refuse("buyer_mismatch", `invoice ${invoice.invoiceId} is another account's`);
  }
  if (isCancelled(invoice)) {
    const reference = invoiceReference(invoice.invoiceId);
    if (!reference.ok) return reference;
    return ok({ reference: reference.value, invoice: null, cancelled: true });
  }
  const built = bidInvoice(invoice);
  if (!built.ok) return built;
  if (amountPence > built.value.invoice.totals.grossPence) {
    return refuse(
      "payment_exceeds_invoice",
      `payment is ${amountPence - built.value.invoice.totals.grossPence} pence more than the invoice`,
    );
  }
  return ok({
    reference: built.value.invoice.reference,
    invoice: built.value.invoice,
    cancelled: false,
  });
}

function checkMoney(currency: string, amountPence: Pence): Result<true, ProjectionCode> {
  if (currency !== CURRENCY) return refuse("not_in_pounds", `payment is in ${currency}, not GBP`);
  if (!isPence(amountPence) || amountPence <= 0) {
    return refuse("bad_amount", "payment must be positive whole pence");
  }
  return ok(true);
}

/** The payment, applied in full and exactly: the allocations must equal what was paid. */
function exactPayment(input: {
  sourceId: string;
  contact: Contact;
  receivedOn: string;
  amountPence: Pence;
  allocations: readonly Allocation[];
}): Result<AccountingDocument, ProjectionCode> {
  const exact = checkExactAllocations(input.amountPence, input.allocations);
  if (!exact.ok) {
    return refuse(
      exact.refusal.code === "allocation_mismatch" ? "allocation_mismatch" : "bad_allocation",
      exact.refusal.message,
    );
  }
  return buildPayment({
    product: "bid",
    sourceId: input.sourceId,
    contactReference: input.contact.reference,
    receivedOn: input.receivedOn,
    amountPence: input.amountPence,
    allocations: exact.value,
  });
}

/**
 * Bid invoice paid (by card, or by bank transfer once all of it arrived): the contact and invoice
 * (a replay when the invoice was already projected), then the payment into the Stripe clearing
 * account, all of it applied to the invoice. A payment for more than the invoice is refused: the
 * remainder would sit unexplained on the buyer's account. A payment for an invoice that has since
 * been cancelled is built and parked (`invoice_cancelled`): a person refunds the buyer, or
 * reinstates the invoice in Bid and releases the payment; the cancelled invoice is not booked again.
 */
export const projectBidPaymentCaptured: ProjectionPolicy<BidPaymentFacts> = (facts) => {
  const money = checkMoney(facts.currency, facts.amountPence);
  if (!money.ok) return money;
  const contact = bidContact(facts.invoice.buyer);
  if (!contact.ok) return contact;
  const paid = paidInvoice(facts.invoice, facts.invoice.buyer, facts.amountPence);
  if (!paid.ok) return paid;
  const payment = exactPayment({
    sourceId: facts.paymentId,
    contact: contact.value,
    receivedOn: facts.capturedOn,
    amountPence: facts.amountPence,
    allocations: [{ invoiceReference: paid.value.reference, amountPence: facts.amountPence }],
  });
  if (!payment.ok) return payment;
  if (paid.value.cancelled) {
    return ok({
      documents: [contact.value, payment.value],
      parked: [{ reference: payment.value.reference, reason: "invoice_cancelled" }],
    });
  }
  return ok({ documents: [contact.value, paid.value.invoice as Invoice, payment.value] });
};

/** A delivery invoice for one courier quote paid with the lots: one delivery line, as charged. Shared with its credit notes. */
export function deliveryInvoice(
  delivery: BidGroupDeliveryFacts,
  contact: Contact,
  settledOn: string,
  deliveryBooking: LineBooking | null,
): Result<Invoice, ProjectionCode> {
  if (!isPence(delivery.amountPence) || delivery.amountPence <= 0) {
    return refuse("bad_amount", "a delivery charge must be positive whole pence");
  }
  const booking = deliveryBooking ?? DELIVERY_DRAFT;
  return buildInvoice({
    product: "bid",
    sourceId: `${DELIVERY_INVOICE_PREFIX}${delivery.quoteId}`,
    contactReference: contact.reference,
    issuedOn: settledOn,
    dueOn: settledOn,
    lines: [
      {
        description: "Delivery",
        quantity: 1,
        unitNetPence: delivery.amountPence,
        treatment: booking.treatment,
        role: booking.role,
      },
    ],
  });
}

/**
 * "Pay several" settled: one charge for several invoices of one buyer account. The buyer's
 * contact, each invoice (a replay of its own flow), a delivery invoice for each courier quote paid
 * with them, then ONE payment into the Stripe clearing account, applied to each invoice by its own
 * payment row's amount and to each delivery invoice by its quote's charge. The allocations must
 * add up to the group's total exactly (`allocation_mismatch` otherwise); nothing is split.
 *
 * Parked, not sent:
 * - every delivery invoice, and the payment with it, while VAT on delivery waits for the
 *   accountant (`vat_on_delivery`); the lots' own invoices are still booked;
 * - the payment, when an invoice it settles was cancelled since (`invoice_cancelled`).
 */
export function bidPaymentGroupSettledPolicy(
  deliveryBooking: LineBooking | null,
): ProjectionPolicy<BidPaymentGroupFacts> {
  return (facts) => projectGroup(facts, deliveryBooking);
}

/** The policy in force: delivery booked as `DELIVERY_BOOKING` says (parked while it is null). */
export const projectBidPaymentGroupSettled: ProjectionPolicy<BidPaymentGroupFacts> =
  bidPaymentGroupSettledPolicy(DELIVERY_BOOKING);

function projectGroup(
  facts: BidPaymentGroupFacts,
  deliveryBooking: LineBooking | null,
): Result<Projection, ProjectionCode> {
  const money = checkMoney(facts.currency, facts.totalPence);
  if (!money.ok) return money;
  if (facts.members.length === 0)
    return refuse("bad_facts", "a group settles at least one invoice");
  const contact = bidContact(facts.buyer);
  if (!contact.ok) return contact;
  const documents: AccountingDocument[] = [contact.value];
  const allocations: Allocation[] = [];
  const parked: ParkedDocument[] = [];
  let paymentParkedFor: ParkReason | null = null;

  for (const member of facts.members) {
    if (!isPence(member.amountPence) || member.amountPence <= 0) {
      return refuse("bad_amount", "each invoice's payment must be positive whole pence");
    }
    const paid = paidInvoice(member.invoice, facts.buyer, member.amountPence);
    if (!paid.ok) return paid;
    if (paid.value.invoice) documents.push(paid.value.invoice);
    if (paid.value.cancelled) paymentParkedFor = "invoice_cancelled";
    allocations.push({ invoiceReference: paid.value.reference, amountPence: member.amountPence });
  }
  for (const delivery of facts.deliveries) {
    const invoice = deliveryInvoice(delivery, contact.value, facts.settledOn, deliveryBooking);
    if (!invoice.ok) return invoice;
    documents.push(invoice.value);
    allocations.push({
      invoiceReference: invoice.value.reference,
      amountPence: delivery.amountPence,
    });
    if (deliveryBooking === null) {
      parked.push({ reference: invoice.value.reference, reason: "vat_on_delivery" });
      paymentParkedFor ??= "vat_on_delivery";
    }
  }

  const payment = exactPayment({
    sourceId: `${GROUP_PAYMENT_PREFIX}${facts.groupId}`,
    contact: contact.value,
    receivedOn: facts.settledOn,
    amountPence: facts.totalPence,
    allocations,
  });
  if (!payment.ok) return payment;
  documents.push(payment.value);
  if (paymentParkedFor)
    parked.push({ reference: payment.value.reference, reason: paymentParkedFor });
  return ok({ documents, parked });
}
