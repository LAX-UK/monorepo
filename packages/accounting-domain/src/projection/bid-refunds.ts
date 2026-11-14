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
import type {
  HeldDocument,
  ParkedDocument,
  Projection,
  ProjectionCode,
  ProjectionPolicy,
} from "./projection.js";

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
  /**
   * Credit notes already registered (not cancelled) in the books the switch aims at now for these
   * refunds, by reference. A refund whose credit note is already there keeps it exactly as stored
   * (it is a replay), and the later refunds are credited after it. So a refund taken back (left out
   * of `refunds`) never reshapes the credit notes of the refunds that stayed, and a credit note an
   * earlier release stored for the same refund (with no `refund` on it) is recognised as that
   * refund's, never refused as a different document.
   */
  readonly registered?: readonly CreditNote[];
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
    const reference = laxReference("bid", "credit_note", refund.refundId);
    if (!reference.ok) return refuse("bad_source_id", reference.refusal.message);
    const stored = facts.registered?.find((note) => note.reference === reference.value);
    if (stored) {
      credits.push(stored);
      continue;
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
  /**
   * Where each of `priorCredits` stands in the books (same order). Read when the refunded total
   * was lowered below what is credited (a refund that failed after it was counted): the newest
   * credit notes never sent are cancelled until the credit fits; one already issued is held for a
   * person instead. Without it, a total below the credit is refused.
   */
  readonly priorStandings?: readonly CreditStanding[];
}

/**
 * Where a credit note already registered stands in the books the switch aims at now, as a
 * reversal reads it: the same reading a buyer default makes of its invoice.
 */
export type CreditStanding = DefaultedInvoiceInBooks;

/** Source ids of the documents a delivery refund makes, kept apart from row ids by a prefix. */
const DELIVERY_CREDIT_PREFIX = "dlv-";

/**
 * The credit note's source id for the step that brings a quote's credit up to `totalPence`:
 * `dlv-<quote>-r<total>`. The same total always gives the same one (two projections of the same
 * state make one document). The running total usually only grows, but a refund that failed after
 * it was counted lowers it (the group's refund repair): the credit notes above it that were never
 * sent are then cancelled, and a cancelled step's reference stays taken, so raising the total to
 * that same figure again with a different amount is refused for a person (`reference_in_use`).
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
  const target = Math.min(facts.refundedPence, facts.chargedPence);
  const lowered = lowerDeliveryCredit(facts, target);
  if (!lowered.ok) return lowered;
  const { priorCredits, cancel, hold } = lowered.value;
  const credited = priorCredits.reduce((sum, c) => sum + c.totals.grossPence, 0);
  if (hold.length > 0) {
    // An issued credit note is above the refunded total: a person decides; nothing more is made.
    return ok({ documents, parked, cancel, hold });
  }
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
      priorCredits,
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
  return ok({ documents, parked, ...(cancel.length > 0 ? { cancel } : {}) });
}

/**
 * The quote's credit notes brought down to the refunded total when it was lowered: newest first,
 * one never sent is cancelled while the credit is above the total; one being sent waits (tried
 * again); one issued (or already with a person) stops it, and an issued one is held for a person.
 * What is left is what a new credit note is built after.
 */
function lowerDeliveryCredit(
  facts: BidDeliveryRefundFacts,
  target: number,
): Result<{ priorCredits: CreditNote[]; cancel: string[]; hold: HeldDocument[] }, ProjectionCode> {
  const priorCredits = [...facts.priorCredits];
  const cancel: string[] = [];
  const hold: HeldDocument[] = [];
  let credited = priorCredits.reduce((sum, c) => sum + c.totals.grossPence, 0);
  for (let i = priorCredits.length - 1; i >= 0 && credited > target; i -= 1) {
    const note = priorCredits[i] as CreditNote;
    const standing = facts.priorStandings?.[i];
    switch (standing) {
      case "absent":
      case "waiting":
        cancel.push(note.reference);
        credited -= note.totals.grossPence;
        priorCredits.splice(i, 1);
        break;
      case "in_flight":
        return refuse("credit_in_flight", "a credit note above the refunded total is being sent");
      case "issued":
      case "held_for_review":
        // Issued, or already with a person for another reason: held (again) as taken back.
        hold.push({ reference: note.reference, reason: "refund_reversed_after_credit" });
        return ok({ priorCredits, cancel, hold });
      default:
        return refuse("bad_facts", "the credit is above the refunded total, standing unknown");
    }
  }
  return ok({ priorCredits, cancel, hold });
}

/**
 * The credit notes registered for refunds of one payment that were taken back (a refund Stripe
 * reported failed after it was counted: a `refund_reversal` row), with where each stands in the
 * books the switch aims at now.
 */
export interface BidRefundReversedFacts {
  readonly reversed: readonly { readonly reference: string; readonly standing: CreditStanding }[];
}

/**
 * A refund taken back after its credit note was made (`payment.refund_reversed`): the buyer never
 * got the money, so the credit must not stand as if they had.
 * - never sent (queued, failed, or parked): cancelled, so it is never sent and never refunded from
 *   clearing; the refunds that stayed keep their credit notes as stored;
 * - issued: no reversing document is defined in the plan yet, so nothing is guessed. It is held for
 *   a person (`refund_reversed_after_credit`, the Books document kept, never refunded from clearing
 *   from then on) and an alert is raised; the accountant says how it is reversed in Books;
 * - being sent, or its outcome unknown: tried again once it settles (and the clearing-refund step
 *   re-checks the refund itself, so a note that settles to issued later is still never refunded);
 * - already with a person for another reason (its refund from clearing refused, say): held again
 *   as `refund_reversed_after_credit`, with the alert, so nobody refunds it by hand.
 */
export const projectBidRefundReversed: ProjectionPolicy<BidRefundReversedFacts> = (facts) => {
  const cancel: string[] = [];
  const hold: HeldDocument[] = [];
  for (const { reference, standing } of facts.reversed) {
    switch (standing) {
      case "absent":
        break;
      case "waiting":
        cancel.push(reference);
        break;
      case "issued":
      case "held_for_review":
        // Held already for another reason (Books refused its refund from clearing, say): held
        // again for this one, so nobody refunds by hand a refund that was taken back.
        hold.push({ reference, reason: "refund_reversed_after_credit" });
        break;
      case "in_flight":
        return refuse("credit_in_flight", "the credit note of a refund taken back is being sent");
      default:
        return refuse("bad_facts", "unknown credit note standing");
    }
  }
  return ok({
    documents: [],
    ...(cancel.length > 0 ? { cancel } : {}),
    ...(hold.length > 0 ? { hold } : {}),
  });
};

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
