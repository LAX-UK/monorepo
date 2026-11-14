import {
  type AccountingDocument,
  type CreditNote,
  type Invoice,
  buildCreditNoteFor,
  laxReference,
} from "../document.js";
import { type Pence, isPence, lineGrossPence } from "../money.js";
import type { PaidBuckets } from "../refund.js";
import { type Result, ok, refuse } from "../result.js";
import { DELIVERY_BOOKING, deliveryInvoice } from "./bid-payments.js";
import {
  type BidBuyerFacts,
  type BidInvoiceFacts,
  type LineBooking,
  bidContact,
  bidInvoice,
} from "./bid.js";
import type { ParkedDocument, Projection, ProjectionCode, ProjectionPolicy } from "./projection.js";

/**
 * One refund that went through on a payment: a `payment_refund` row. Such a row is written only
 * once Stripe reports the refund succeeded, so a pending refund that later fails never has one.
 * A refund taken back later (Stripe reported it failed after it was counted) is left out by the
 * reader with the compensating row that took it back.
 */
export interface BidRefundFacts {
  /** The `payment_refund` row's id: the credit note's source id (`LAX-BID-CN-<id>`). */
  readonly refundId: string;
  readonly amountPence: Pence;
  readonly refundedOn: string;
}

/**
 * Every refund on one payment of one invoice, oldest first, with what that payment took for the
 * invoice (a "Pay several" member: its own payment row's amount, not the group's charge).
 */
export interface BidRefundsFacts {
  readonly invoice: BidInvoiceFacts;
  readonly paidPence: Pence;
  readonly refunds: readonly BidRefundFacts[];
}

/** The credit note given for a refund: exactly the refund (less any part above what was charged). */
function goodsBuckets(invoice: Invoice, paidPence: Pence, credited: CreditNote[]): PaidBuckets {
  const goodsGross = invoice.lines
    .filter((l) => l.role === "goods")
    .reduce((sum, l) => sum + lineGrossPence(l), 0);
  const paidGoodsPence = Math.min(paidPence, goodsGross);
  let refundedGoodsPence = 0;
  let refundedDeliveryPence = 0;
  for (const credit of credited) {
    for (const line of credit.lines) {
      if (line.role === "goods") refundedGoodsPence += lineGrossPence(line);
      else refundedDeliveryPence += lineGrossPence(line);
    }
  }
  return {
    paidGoodsPence,
    paidDeliveryPence: paidPence - paidGoodsPence,
    refundedGoodsPence,
    refundedDeliveryPence,
  };
}

/**
 * Bid payment refunded (staff, card webhook, blocked capture, or one invoice of a "Pay several"
 * charge): the contact and invoice (a replay of the invoice's own flow), then one credit note per
 * refund, oldest first, each refunded from the Stripe clearing account. Every refund of the payment
 * is replayed in order, so each credit note is the same document however often this runs.
 *
 * Never more than was charged: each credit note takes its refund up to what the payment still has
 * to give back on this invoice (goods first, then delivery). A refund above that (a "Pay several"
 * refund the buyer's record holds above the invoice, say) is credited only up to it, and one that
 * finds nothing left makes no credit note: the rest is not this invoice's to credit.
 */
export const projectBidPaymentRefunded: ProjectionPolicy<BidRefundsFacts> = (facts) => {
  const built = bidInvoice(facts.invoice);
  if (!built.ok) return built;
  const { contact, invoice } = built.value;
  if (!isPence(facts.paidPence) || facts.paidPence <= 0) {
    return refuse("bad_amount", "what was paid must be positive whole pence");
  }
  if (facts.paidPence > invoice.totals.grossPence) {
    return refuse("payment_exceeds_invoice", "the payment took more than the invoice charged");
  }
  const credits: CreditNote[] = [];
  for (const refund of facts.refunds) {
    if (!isPence(refund.amountPence) || refund.amountPence <= 0) {
      return refuse("bad_amount", "a refund must be positive whole pence");
    }
    const buckets = goodsBuckets(invoice, facts.paidPence, credits);
    const left =
      buckets.paidGoodsPence -
      buckets.refundedGoodsPence +
      buckets.paidDeliveryPence -
      buckets.refundedDeliveryPence;
    const take = Math.min(refund.amountPence, left);
    if (take <= 0) continue;
    const goodsPence = Math.min(take, buckets.paidGoodsPence - buckets.refundedGoodsPence);
    const credit = buildCreditNoteFor(invoice, {
      sourceId: refund.refundId,
      issuedOn: refund.refundedOn,
      buckets,
      request: { goodsPence, deliveryPence: take - goodsPence },
      priorCredits: credits,
      refund: { account: "stripe_clearing", refundedOn: refund.refundedOn },
    });
    if (!credit.ok) return credit;
    credits.push(credit.value);
  }
  return ok({ documents: [contact, invoice, ...credits] });
};

/**
 * A courier quote paid in a "Pay several" charge, with what has been refunded of it so far
 * (`payment_group_delivery.refunded_pence`, a running total the group keeps) and the credit notes
 * already registered for its delivery invoice in the same books, in the order they were made.
 */
export interface BidDeliveryRefundFacts {
  readonly groupId: string;
  readonly buyer: BidBuyerFacts;
  readonly quoteId: string;
  /** What the quote was charged (`payment_group_delivery.amount`). */
  readonly chargedPence: Pence;
  /** The London day the group was settled: the delivery invoice's date. */
  readonly settledOn: string;
  /** The refunded running total, as the group holds it now. */
  readonly refundedPence: Pence;
  /** The London day of the refund that raised it to this total. */
  readonly refundedOn: string;
  /** Credit notes already registered for the delivery invoice (not cancelled), oldest first. */
  readonly priorCredits: readonly CreditNote[];
}

/** Source ids of the documents a delivery refund makes, kept apart from row ids by a prefix. */
const DELIVERY_CREDIT_PREFIX = "dlv-";

/**
 * The credit note's source id for the step that brings a quote's credit up to `totalPence`:
 * `dlv-<quote>-r<total>`. The running total only grows, so each step has its own reference, and
 * the same total always gives the same one (two projections of the same state make one document).
 */
export function deliveryCreditSourceId(quoteId: string, totalPence: Pence): string {
  return `${DELIVERY_CREDIT_PREFIX}${quoteId}-r${totalPence}`;
}

/**
 * Courier delivery refunded inside "Pay several": the contact, the quote's delivery invoice (built
 * as the group's flow builds it), and a credit note for what the running total rose by since the
 * credit notes already made for it (never more than the quote was charged). Nothing new when the
 * credit already reaches the total. Refunded from the Stripe clearing account.
 *
 * While VAT on delivery waits for the accountant (`DELIVERY_BOOKING` unset) the delivery invoice is
 * a parked draft, so its credit notes are parked with it (`vat_on_delivery`).
 */
export function bidDeliveryRefundedPolicy(
  deliveryBooking: LineBooking | null,
): ProjectionPolicy<BidDeliveryRefundFacts> {
  return (facts) => projectDeliveryRefund(facts, deliveryBooking);
}

export const projectBidDeliveryRefunded: ProjectionPolicy<BidDeliveryRefundFacts> =
  bidDeliveryRefundedPolicy(DELIVERY_BOOKING);

function projectDeliveryRefund(
  facts: BidDeliveryRefundFacts,
  deliveryBooking: LineBooking | null,
): Result<Projection, ProjectionCode> {
  if (!isPence(facts.refundedPence) || facts.refundedPence < 0) {
    return refuse("bad_amount", "a refunded total must be whole pence, not below zero");
  }
  const contact = bidContact(facts.buyer);
  if (!contact.ok) return contact;
  const invoice = deliveryInvoice(
    { quoteId: facts.quoteId, amountPence: facts.chargedPence },
    contact.value,
    facts.settledOn,
    deliveryBooking,
  );
  if (!invoice.ok) return invoice;
  const documents: AccountingDocument[] = [contact.value, invoice.value];
  const parked: ParkedDocument[] = [];
  if (deliveryBooking === null) {
    parked.push({ reference: invoice.value.reference, reason: "vat_on_delivery" });
  }
  const credited = facts.priorCredits.reduce((sum, c) => sum + c.totals.grossPence, 0);
  const target = Math.min(facts.refundedPence, facts.chargedPence);
  if (target > credited) {
    const credit = buildCreditNoteFor(invoice.value, {
      sourceId: deliveryCreditSourceId(facts.quoteId, target),
      issuedOn: facts.refundedOn < facts.settledOn ? facts.settledOn : facts.refundedOn,
      buckets: {
        paidGoodsPence: 0,
        paidDeliveryPence: facts.chargedPence,
        refundedGoodsPence: 0,
        refundedDeliveryPence: credited,
      },
      request: { goodsPence: 0, deliveryPence: target - credited },
      priorCredits: facts.priorCredits,
      refund: {
        account: "stripe_clearing",
        refundedOn: facts.refundedOn < facts.settledOn ? facts.settledOn : facts.refundedOn,
      },
    });
    if (!credit.ok) return credit;
    documents.push(credit.value);
    if (deliveryBooking === null) {
      parked.push({ reference: credit.value.reference, reason: "vat_on_delivery" });
    }
  }
  return ok({ documents, parked });
}

/**
 * How the books take an issued Bid invoice cancelled after a buyer default. NOT SET: the
 * accountant has not answered "credit note or void". While it is null the full credit note (plan
 * F13) is built and parked (`buyer_default_treatment`), never sent.
 *
 * Extension point, waiting for the accountant (nothing here chooses):
 * - `credit_note`: the parked credit notes are released by staff (Release, in Accounting), and
 *   later defaults are queued as they come.
 * - `void`: voiding in the books is not built; the credit notes stay parked and Release says so.
 */
export const BID_DEFAULT_TREATMENTS = ["credit_note", "void"] as const;
export type BidDefaultTreatment = (typeof BID_DEFAULT_TREATMENTS)[number];
export const BID_DEFAULT_ACCOUNTING_TREATMENT: BidDefaultTreatment | null = null;

/** Where the invoice a buyer default cancels stands in the books the switch aims at now. */
export type DefaultedInvoiceInBooks =
  /** Never registered there (or already cancelled): nothing to undo. */
  | "absent"
  /** Registered and never sent (queued, failed, or waiting for a person with nothing in Books). */
  | "waiting"
  /** Being sent, or its outcome is unknown: decided once it settles. */
  | "in_flight"
  /** Issued: it is credited in full. */
  | "issued"
  /** In Books but held for a person (its totals differ, say). */
  | "held_for_review";

/** An invoice voided by a buyer default, read from its stored rows (its lines are kept). */
export interface BidBuyerDefaultFacts {
  readonly invoice: BidInvoiceFacts;
  /** The London day the default was recorded. */
  readonly defaultedOn: string;
  readonly inBooks: DefaultedInvoiceInBooks;
  /** Credit notes already registered for the invoice in the same books (not cancelled), oldest first. */
  readonly priorCredits: readonly CreditNote[];
}

const DEFAULT_CREDIT_PREFIX = "dft-";

/** The full credit note's source id for a defaulted invoice: `dft-<invoice>`. */
export function defaultCreditSourceId(invoiceId: string): string {
  return `${DEFAULT_CREDIT_PREFIX}${invoiceId}`;
}

/**
 * Bid buyer default (`payment.cancelled` from the buyer default service):
 * - the invoice was never sent to the books: it is cancelled there (`cancel`), and nothing is made;
 * - it was issued: a credit note for everything the invoice still holds (its whole gross less any
 *   earlier credit notes), line by line, with no money given back (nothing was paid). Parked
 *   (`buyer_default_treatment`) until the accountant's answer is set, and never sent while it is.
 * - in flight, or held for a person: refused (tried again later, or left to the person).
 */
export function bidBuyerDefaultPolicy(
  treatment: BidDefaultTreatment | null,
): ProjectionPolicy<BidBuyerDefaultFacts> {
  return (facts) => projectDefault(facts, treatment);
}

export const projectBidBuyerDefault: ProjectionPolicy<BidBuyerDefaultFacts> = bidBuyerDefaultPolicy(
  BID_DEFAULT_ACCOUNTING_TREATMENT,
);

function projectDefault(
  facts: BidBuyerDefaultFacts,
  treatment: BidDefaultTreatment | null,
): Result<Projection, ProjectionCode> {
  const reference = laxReference("bid", "invoice", facts.invoice.invoiceId);
  if (!reference.ok) return refuse("bad_source_id", reference.refusal.message);
  switch (facts.inBooks) {
    case "absent":
      return ok({ documents: [] });
    case "waiting":
      return ok({ documents: [], cancel: [reference.value] });
    case "in_flight":
      return refuse("invoice_in_flight", "the invoice is being sent; decided once it settles");
    case "held_for_review":
      return refuse("invoice_held_for_review", "the invoice is held for a person in the books");
    case "issued":
      break;
    default:
      return refuse("bad_facts", "unknown invoice standing");
  }
  const built = bidInvoice(facts.invoice);
  if (!built.ok) return built;
  const { contact, invoice } = built.value;
  const roles = { goods: 0, delivery: 0 };
  for (const line of invoice.lines) roles[line.role] += lineGrossPence(line);
  const credited = { goods: 0, delivery: 0 };
  for (const prior of facts.priorCredits) {
    for (const line of prior.lines) credited[line.role] += lineGrossPence(line);
  }
  const goodsPence = roles.goods - credited.goods;
  const deliveryPence = roles.delivery - credited.delivery;
  if (goodsPence + deliveryPence <= 0) return ok({ documents: [contact, invoice] });
  const credit = buildCreditNoteFor(invoice, {
    sourceId: defaultCreditSourceId(facts.invoice.invoiceId),
    issuedOn: facts.defaultedOn < invoice.issuedOn ? invoice.issuedOn : facts.defaultedOn,
    // A cancellation, not a refund: what the invoice charged is what may be credited.
    buckets: {
      paidGoodsPence: roles.goods,
      paidDeliveryPence: roles.delivery,
      refundedGoodsPence: credited.goods,
      refundedDeliveryPence: credited.delivery,
    },
    request: { goodsPence, deliveryPence },
    priorCredits: facts.priorCredits,
  });
  if (!credit.ok) return credit;
  const parked: ParkedDocument[] =
    treatment === "credit_note"
      ? []
      : [{ reference: credit.value.reference, reason: "buyer_default_treatment" }];
  return ok({ documents: [contact, invoice, credit.value], parked });
}
