import {
  type Contact,
  type CreditNote,
  type Invoice,
  buildContact,
  buildCreditNoteFor,
  buildInvoice,
} from "../document.js";
import {
  type LineInput,
  type LineRole,
  type Pence,
  type VatTreatment,
  isPence,
  lineGrossPence,
} from "../money.js";
import { splitRefundTotal } from "../refund.js";
import { type Result, ok, refuse } from "../result.js";
import type { Projection, ProjectionCode, ProjectionPolicy } from "./projection.js";

/** The buyer account an invoice is raised to. */
export interface BidBuyerFacts {
  /** The buyer's legal entity id: the contact's source id, so one account is one contact. */
  readonly legalEntityId: string;
  readonly name: string;
  readonly email: string | null;
}

/** One stored invoice line, as LAX raised it (whole pence, no VAT added). */
export interface BidInvoiceLineFacts {
  /** The stored line's id, so a reader can check these are the lines the event named. */
  readonly id?: string;
  readonly kind: string;
  readonly label: string;
  readonly amountPence: Pence;
}

/** A raised Bid invoice, read from its stored rows. Dates are London calendar days. */
export interface BidInvoiceFacts {
  readonly invoiceId: string;
  readonly buyer: BidBuyerFacts;
  readonly raisedOn: string;
  readonly dueOn: string;
  readonly lines: readonly BidInvoiceLineFacts[];
}

/** One refund given back on a payment (a `payment_refund` row: it exists only once it went through). */
export interface BidRefundFacts {
  readonly refundId: string;
  readonly amountPence: Pence;
  readonly refundedOn: string;
}

/** Every refund on one payment, oldest first, with what the payment took. */
export interface BidRefundsFacts {
  readonly invoice: BidInvoiceFacts;
  readonly paidPence: Pence;
  readonly refunds: readonly BidRefundFacts[];
}

export interface LineBooking {
  readonly role: LineRole;
  readonly treatment: VatTreatment;
}

/**
 * How each stored Bid invoice line is booked. LAX Bid charges no VAT on hammer or premium today,
 * so both go as margin-scheme goods (no VAT shown, nothing for the provider to work out) until the
 * accountant confirms the treatments; this table is the one place that changes. The premium line
 * is booked with the label it was raised with (its rate or bands), never worked out again.
 *
 * Extension points, waiting for the accountant (nothing here adds them):
 * - VAT on the buyer's premium: change `buyers_premium` to its confirmed treatment here. The line
 *   amount stays the stored net; the domain adds VAT per line, and Books' total is checked against it.
 * - Artist's resale right (ARR) and the other kinds in `BID_LINES_AWAITING_ACCOUNTANT`: add a
 *   row here with the confirmed role and treatment, and take the kind out of that list.
 */
export const BID_LINE_BOOKINGS: Readonly<Record<string, LineBooking>> = {
  hammer: { role: "goods", treatment: "margin_scheme" },
  buyers_premium: { role: "goods", treatment: "margin_scheme" },
  legacy_total: { role: "goods", treatment: "margin_scheme" },
};

/**
 * Line kinds a Bid invoice can store whose booking the accountant has not confirmed. An invoice
 * carrying one is refused (`line_awaiting_accountant`) and waits for a person, never guessed.
 */
export const BID_LINES_AWAITING_ACCOUNTANT: readonly string[] = [
  "vat_on_hammer",
  "import_vat",
  "artists_resale_right",
  "delivery",
];

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** The buyer's contact; every Bid flow names the same one for the same account. */
export function bidContact(buyer: BidBuyerFacts): Result<Contact, ProjectionCode> {
  // An address the books would refuse is left off the contact rather than stopping the invoice:
  // the contact is still the same account (keyed by its id), and Books needs no email to book it.
  const email = typeof buyer.email === "string" && EMAIL.test(buyer.email) ? buyer.email : null;
  return buildContact({
    product: "bid",
    sourceId: buyer.legalEntityId,
    name: buyer.name,
    email,
  });
}

function bidLines(lines: readonly BidInvoiceLineFacts[]): Result<LineInput[], ProjectionCode> {
  const out: LineInput[] = [];
  for (const line of lines) {
    const booking = Object.hasOwn(BID_LINE_BOOKINGS, line.kind)
      ? BID_LINE_BOOKINGS[line.kind]
      : undefined;
    if (!booking && BID_LINES_AWAITING_ACCOUNTANT.includes(line.kind)) {
      return refuse(
        "line_awaiting_accountant",
        `invoice line kind ${line.kind} waits for the accountant's booking`,
      );
    }
    if (!booking) return refuse("unmapped_line", `no booking for invoice line kind ${line.kind}`);
    // A line of nothing (a premium of 0%) says nothing in the books.
    if (line.amountPence === 0) continue;
    out.push({
      description: line.label,
      quantity: 1,
      unitNetPence: line.amountPence,
      treatment: booking.treatment,
      role: booking.role,
    });
  }
  return ok(out);
}

export interface InvoiceWithContact {
  readonly contact: Contact;
  readonly invoice: Invoice;
}

/** The contact and invoice for a raised Bid invoice; every Bid flow starts from these two. */
export function bidInvoice(facts: BidInvoiceFacts): Result<InvoiceWithContact, ProjectionCode> {
  const contact = bidContact(facts.buyer);
  if (!contact.ok) return contact;
  const lines = bidLines(facts.lines);
  if (!lines.ok) return lines;
  const invoice = buildInvoice({
    product: "bid",
    sourceId: facts.invoiceId,
    contactReference: contact.value.reference,
    issuedOn: facts.raisedOn,
    dueOn: facts.dueOn,
    lines: lines.value,
  });
  if (!invoice.ok) return invoice;
  return ok({ contact: contact.value, invoice: invoice.value });
}

/** Bid invoice raised: the buyer's contact, then the invoice. */
export const projectBidInvoiceRaised: ProjectionPolicy<BidInvoiceFacts> = (facts) => {
  const built = bidInvoice(facts);
  if (!built.ok) return built;
  return ok({ documents: [built.value.contact, built.value.invoice] });
};

/**
 * Bid payment refunded: the contact and invoice, then one credit note per refund for exactly its
 * amount, oldest first. Every refund of the payment is replayed in order, so each credit note is
 * the same document however often this runs, and the credit notes can never total more than was
 * paid (goods first, then delivery, as `splitRefundTotal` decides).
 */
export const projectBidPaymentRefunded: ProjectionPolicy<BidRefundsFacts> = (facts) => {
  const built = bidInvoice(facts.invoice);
  if (!built.ok) return built;
  const { contact, invoice } = built.value;
  if (!isPence(facts.paidPence) || facts.paidPence <= 0) {
    return refuse("bad_amount", "what was paid must be positive whole pence");
  }
  const goodsGross = invoice.lines
    .filter((l) => l.role === "goods")
    .reduce((sum, l) => sum + lineGrossPence(l), 0);
  const paidGoodsPence = Math.min(facts.paidPence, goodsGross);
  const paid = { paidGoodsPence, paidDeliveryPence: facts.paidPence - paidGoodsPence };
  const credits: CreditNote[] = [];
  let refundedGoodsPence = 0;
  let refundedDeliveryPence = 0;
  for (const refund of facts.refunds) {
    const buckets = { ...paid, refundedGoodsPence, refundedDeliveryPence };
    const split = splitRefundTotal(buckets, refund.amountPence);
    if (!split.ok) return refuse("refund_refused", split.refusal.message);
    const credit = buildCreditNoteFor(invoice, {
      sourceId: refund.refundId,
      issuedOn: refund.refundedOn,
      buckets,
      request: split.value,
      priorCredits: credits,
    });
    if (!credit.ok) return credit;
    credits.push(credit.value);
    refundedGoodsPence += split.value.goodsPence;
    refundedDeliveryPence += split.value.deliveryPence;
  }
  const documents: Projection["documents"] = [contact, invoice, ...credits];
  return ok({ documents });
};
