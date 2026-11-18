import { isValidIsoDate } from "./dates.js";
import {
  CURRENCY,
  LINE_ROLES,
  type Line,
  type LineInput,
  type LineRole,
  MAX_LINES,
  type Pence,
  STANDARD_VAT_RATE_BPS,
  type Totals,
  buildInclusiveLine,
  buildLine,
  cumulativeVat,
  isPence,
  lineGrossPence,
  totalsOf,
  vatInsideGross,
} from "./money.js";
import { type PaidBuckets, type RefundSplit, planRefund } from "./refund.js";
import { type Result, ok, refuse } from "./result.js";
import { compareText } from "./text.js";

export const DOCUMENT_KINDS = [
  "invoice",
  "payment",
  "credit_note",
  "bill",
  "contact",
  "expense",
  "transfer",
  "bill_payment",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Which LAX product a document comes from. */
export const PRODUCTS = ["bid", "shop", "lax_art"] as const;
export type Product = (typeof PRODUCTS)[number];

export const LEGAL_ENTITIES = ["london_auction_xchange", "london_art_exchange"] as const;
export type LegalEntity = (typeof LEGAL_ENTITIES)[number];

/** Registered names as they appear on provider documents. Keep in step with @auction/branding. */
export const LEGAL_ENTITY_NAMES: Readonly<Record<LegalEntity, string>> = {
  london_auction_xchange: "London Auction Xchange LTD",
  london_art_exchange: "London Art Exchange Ltd",
};

/** Bid trades as London Auction Xchange LTD; Shop and lax.art as London Art Exchange Ltd. */
export function legalEntityFor(product: Product): LegalEntity {
  return product === "bid" ? "london_auction_xchange" : "london_art_exchange";
}

const KIND_PREFIX: Readonly<Record<DocumentKind, string>> = {
  invoice: "INV",
  payment: "PAY",
  credit_note: "CN",
  bill: "BILL",
  contact: "CON",
  expense: "EXP",
  transfer: "TRF",
  bill_payment: "BPAY",
};

/** Part of every reference, so the same source id in two products can never collide. */
const PRODUCT_PREFIX: Readonly<Record<Product, string>> = {
  bid: "BID",
  shop: "SHOP",
  lax_art: "ART",
};

/**
 * Lower case only. Providers may search references case-insensitively, so `abc` and `ABC` would
 * be one document; callers lower-case a canonical id (a ULID, say) before using it.
 */
const SOURCE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export interface ReferenceParts {
  readonly product: Product;
  readonly kind: DocumentKind;
  readonly sourceId: string;
}

/**
 * The stable LAX reference of a document, `LAX-<PRODUCT>-<KIND>-<id>`. The same product, kind and
 * source id always give the same text, and no two different triples give the same text, so it is
 * the duplicate guard and the key for looking a document up in a provider. This is the only way to
 * make a reference; builders take a source id, never a reference string.
 */
export function laxReference(
  product: Product,
  kind: DocumentKind,
  sourceId: string,
): Result<string, "bad_source_id"> {
  if (typeof sourceId !== "string" || !SOURCE_ID.test(sourceId)) {
    return refuse("bad_source_id", "source id must be 1-64 lower-case letters, digits, '_' or '-'");
  }
  return ok(`LAX-${PRODUCT_PREFIX[product]}-${KIND_PREFIX[kind]}-${sourceId}`);
}

const PRODUCT_BY_PREFIX = new Map(PRODUCTS.map((p) => [PRODUCT_PREFIX[p], p] as const));
const KIND_BY_PREFIX = new Map(DOCUMENT_KINDS.map((k) => [KIND_PREFIX[k], k] as const));

/** Read a reference back into its parts; only text `laxReference` could have made parses. */
export function parseLaxReference(reference: string): Result<ReferenceParts, "bad_reference"> {
  const m = /^LAX-([A-Z]+)-([A-Z]+)-(.+)$/.exec(typeof reference === "string" ? reference : "");
  const product = m ? PRODUCT_BY_PREFIX.get(m[1] as string) : undefined;
  const kind = m ? KIND_BY_PREFIX.get(m[2] as string) : undefined;
  if (!m || !product || !kind || !SOURCE_ID.test(m[3] as string)) {
    return refuse("bad_reference", "not a LAX reference");
  }
  return ok({ product, kind, sourceId: m[3] as string });
}

export type DocumentCode =
  | "bad_date"
  | "no_lines"
  | "too_many_lines"
  | "bad_line"
  | "bad_amount"
  | "zero_total"
  | "bad_allocation"
  | "over_allocated"
  | "bad_name"
  | "bad_source_id"
  | "bad_reference"
  | "exceeds_invoice"
  | "bad_invoice"
  | "bad_email"
  | "bad_number"
  | "refund_refused";

interface Base<K extends DocumentKind> {
  readonly kind: K;
  readonly reference: string;
  readonly entity: LegalEntity;
  readonly product: Product;
}

export interface Contact extends Base<"contact"> {
  readonly name: string;
  readonly email: string | null;
}

export interface Invoice extends Base<"invoice"> {
  /**
   * Absent (tax-exclusive) for an invoice whose VAT the domain adds per line. `tax_inclusive` for
   * one sold at VAT-inclusive prices (Shop): every line's gross and VAT are what LAX stored when
   * it sold, never worked out again, and the adapter sends the gross with the stated VAT.
   */
  readonly amountsAre?: "tax_inclusive";
  /**
   * The number LAX already gave the invoice (Shop: `LAX-INV-000124`, gap-free from the Shop's own
   * counter), so the books continue that series instead of numbering it again. Absent when the
   * provider numbers it.
   */
  readonly number?: string;
  readonly contactReference: string;
  readonly currency: typeof CURRENCY;
  readonly issuedOn: string;
  readonly dueOn: string;
  readonly lines: readonly Line[];
  readonly totals: Totals;
}

export interface CreditNote extends Base<"credit_note"> {
  /** Every line is gross with the VAT inside it; the adapter sends the gross and the stated VAT. */
  readonly amountsAre: "tax_inclusive";
  readonly contactReference: string;
  readonly invoiceReference: string;
  readonly currency: typeof CURRENCY;
  readonly issuedOn: string;
  readonly lines: readonly Line[];
  readonly totals: Totals;
  /**
   * Present when the credit is money given back to the buyer (a refund that went through): the
   * credit note's whole gross is then refunded from this account, once, after the credit note is
   * issued (`planCreditNoteRefund`). Absent for a credit that returns no money (an unpaid invoice
   * cancelled after a buyer default), which stays on the invoice it credits.
   */
  readonly refund?: CreditNoteRefundSource;
}

/** Where the money a credit note gives back was paid from, and on which London day. */
export interface CreditNoteRefundSource {
  readonly account: "stripe_clearing";
  readonly refundedOn: string;
}

/** A bill we owe to a seller or artist (a payout). */
export interface Bill extends Base<"bill"> {
  readonly contactReference: string;
  readonly currency: typeof CURRENCY;
  readonly issuedOn: string;
  readonly dueOn: string;
  readonly lines: readonly Line[];
  readonly totals: Totals;
}

/**
 * LAX paying a bill it owes (a seller's or artist's payout), in full, from one of its own
 * accounts: today only the Stripe clearing account, which a Stripe Connect transfer leaves. A
 * payout paid any other way names no account in LAX, so its payment is never built as if it had.
 */
export interface BillPayment extends Base<"bill_payment"> {
  /** The vendor contact the bill is to. */
  readonly contactReference: string;
  readonly billReference: string;
  readonly currency: typeof CURRENCY;
  readonly paidOn: string;
  readonly amountPence: Pence;
  readonly paidFrom: "stripe_clearing";
}

export interface PaymentAllocation {
  readonly invoiceReference: string;
  readonly amountPence: Pence;
}

export interface Payment extends Base<"payment"> {
  readonly contactReference: string;
  readonly currency: typeof CURRENCY;
  readonly receivedOn: string;
  readonly amountPence: Pence;
  readonly allocations: readonly PaymentAllocation[];
  /** Received money that is not allocated to an invoice (held as credit on the contact). */
  readonly unallocatedPence: Pence;
}

/**
 * Money LAX spent, paid straight out of one of its own accounts (no supplier contact, no VAT):
 * today only the fees Stripe takes, paid from the Stripe clearing account. Books records it as an
 * expense to the organisation's Stripe fees account, paid through the clearing account.
 */
export interface Expense extends Base<"expense"> {
  /** What the money was spent on; the adapter maps each category to an account. */
  readonly category: (typeof EXPENSE_CATEGORIES)[number];
  /** The account it was paid from. */
  readonly paidFrom: "stripe_clearing";
  readonly currency: typeof CURRENCY;
  readonly spentOn: string;
  readonly amountPence: Pence;
  /** What finance reads in Books: ids only (a Stripe balance transaction id), never a name. */
  readonly description: string;
}

export const EXPENSE_CATEGORIES = ["stripe_fees"] as const;

/**
 * Money moved between two of LAX's own accounts: today only a Stripe payout, from the Stripe
 * clearing account to the bank account it was paid into.
 */
export interface Transfer extends Base<"transfer"> {
  readonly from: "stripe_clearing";
  readonly to: "bank";
  readonly currency: typeof CURRENCY;
  readonly transferredOn: string;
  readonly amountPence: Pence;
  /** What finance reads in Books: ids only (a Stripe payout id), never a name. */
  readonly description: string;
}

export type AccountingDocument =
  | Contact
  | Invoice
  | CreditNote
  | Bill
  | Payment
  | Expense
  | Transfer
  | BillPayment;

/** Which product a document is for, and the source row's id; the reference is derived from them. */
interface Common {
  readonly product: Product;
  readonly sourceId: string;
}

function base<K extends DocumentKind>(kind: K, c: Common): Result<Base<K>, "bad_source_id"> {
  const reference = laxReference(c.product, kind, c.sourceId);
  if (!reference.ok) return reference;
  return ok({
    kind,
    reference: reference.value,
    product: c.product,
    entity: legalEntityFor(c.product),
  });
}

function checkDates(...dates: string[]): Result<null, "bad_date"> {
  return dates.every((d) => isValidIsoDate(d))
    ? ok(null)
    : refuse("bad_date", "dates are real calendar dates written YYYY-MM-DD");
}

/** A reference of the wanted kind that belongs to the same product as the document. */
function checkRef(
  reference: string,
  kind: DocumentKind,
  product: Product,
): Result<string, "bad_reference"> {
  const parsed = parseLaxReference(reference);
  if (!parsed.ok || parsed.value.kind !== kind || parsed.value.product !== product) {
    return refuse("bad_reference", `expected a ${kind} reference for ${product}`);
  }
  return ok(reference);
}

function buildLines(inputs: readonly LineInput[]): Result<readonly Line[], DocumentCode> {
  if (inputs.length === 0) return refuse("no_lines", "a document needs at least one line");
  if (inputs.length > MAX_LINES) return refuse("too_many_lines", `at most ${MAX_LINES} lines`);
  const lines: Line[] = [];
  for (const input of inputs) {
    const line = buildLine(input);
    if (!line.ok) return refuse("bad_line", line.refusal.message);
    lines.push(line.value);
  }
  const totals = totalsOf(lines);
  if (totals.grossPence === 0) return refuse("zero_total", "a document cannot total zero");
  return ok(lines);
}

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function buildContact(
  input: Common & { name: string; email?: string | null },
): Result<Contact, DocumentCode> {
  const b = base("contact", input);
  if (!b.ok) return b;
  if (typeof input.name !== "string" || input.name.trim() === "") {
    return refuse("bad_name", "contact needs a name");
  }
  const email = input.email ?? null;
  if (email !== null && (typeof email !== "string" || !EMAIL.test(email))) {
    return refuse("bad_email", "email must look like name@domain");
  }
  return ok({ ...b.value, name: input.name.trim(), email });
}

interface Priced {
  readonly contactReference: string;
  readonly issuedOn: string;
  readonly dueOn: string;
  readonly lines: readonly LineInput[];
}

function pricedParts(
  input: Common & Priced,
): Result<{ contactReference: string; lines: readonly Line[] }, DocumentCode> {
  const contact = checkRef(input.contactReference, "contact", input.product);
  if (!contact.ok) return contact;
  const dates = checkDates(input.issuedOn, input.dueOn);
  if (!dates.ok) return dates;
  if (input.dueOn < input.issuedOn) return refuse("bad_date", "due date is before issue date");
  const lines = buildLines(input.lines);
  if (!lines.ok) return lines;
  return ok({ contactReference: contact.value, lines: lines.value });
}

export function buildInvoice(input: Common & Priced): Result<Invoice, DocumentCode> {
  const b = base("invoice", input);
  if (!b.ok) return b;
  const parts = pricedParts(input);
  if (!parts.ok) return parts;
  return ok({
    ...b.value,
    contactReference: parts.value.contactReference,
    currency: CURRENCY,
    issuedOn: input.issuedOn,
    dueOn: input.dueOn,
    lines: parts.value.lines,
    totals: totalsOf(parts.value.lines),
  });
}

/** One line of a VAT-inclusive invoice: the gross the buyer paid and the VAT inside it, as stored. */
export interface InclusiveLineInput {
  readonly description: string;
  readonly grossPence: Pence;
  readonly vatPence: Pence;
  readonly treatment: LineInput["treatment"];
  readonly role: LineRole;
}

/** An invoice number LAX issued: upper-case letters, digits and '-', at most 32. */
const INVOICE_NUMBER = /^[A-Z0-9][A-Z0-9-]{0,31}$/;

export function isInvoiceNumber(value: unknown): value is string {
  return typeof value === "string" && INVOICE_NUMBER.test(value);
}

/**
 * An invoice sold at VAT-inclusive prices, numbered by LAX. Each line is built from its stored
 * gross and VAT (`buildInclusiveLine`), so nothing is recomputed: the totals are the exact sum of
 * what the buyer was charged.
 */
export function buildInclusiveInvoice(
  input: Common & {
    readonly contactReference: string;
    readonly issuedOn: string;
    readonly dueOn: string;
    readonly number: string;
    readonly lines: readonly InclusiveLineInput[];
  },
): Result<Invoice, DocumentCode> {
  const b = base("invoice", input);
  if (!b.ok) return b;
  if (!isInvoiceNumber(input.number)) {
    return refuse("bad_number", "an invoice number is 1-32 upper-case letters, digits or '-'");
  }
  const contact = checkRef(input.contactReference, "contact", input.product);
  if (!contact.ok) return contact;
  const dates = checkDates(input.issuedOn, input.dueOn);
  if (!dates.ok) return dates;
  if (input.dueOn < input.issuedOn) return refuse("bad_date", "due date is before issue date");
  if (input.lines.length === 0) return refuse("no_lines", "a document needs at least one line");
  if (input.lines.length > MAX_LINES) return refuse("too_many_lines", `at most ${MAX_LINES} lines`);
  const lines: Line[] = [];
  for (const line of input.lines) {
    const built = buildInclusiveLine(line);
    if (!built.ok) return refuse("bad_line", built.refusal.message);
    lines.push(built.value);
  }
  const totals = totalsOf(lines);
  if (totals.grossPence === 0) return refuse("zero_total", "a document cannot total zero");
  return ok({
    ...b.value,
    amountsAre: "tax_inclusive",
    number: input.number,
    contactReference: contact.value,
    currency: CURRENCY,
    issuedOn: input.issuedOn,
    dueOn: input.dueOn,
    lines,
    totals,
  });
}

export function buildBill(input: Common & Priced): Result<Bill, DocumentCode> {
  const b = base("bill", input);
  if (!b.ok) return b;
  const parts = pricedParts(input);
  if (!parts.ok) return parts;
  return ok({
    ...b.value,
    contactReference: parts.value.contactReference,
    currency: CURRENCY,
    issuedOn: input.issuedOn,
    dueOn: input.dueOn,
    lines: parts.value.lines,
    totals: totalsOf(parts.value.lines),
  });
}

/**
 * A vendor contact's source id: `vendor-<id>`. Books keeps the people LAX pays (vendors) apart
 * from the people it invoices (customers), and one legal entity or party may be both, so a vendor
 * is its own contact in LAX too (`LAX-BID-CON-vendor-<id>`), never the customer contact re-used.
 */
export function vendorContactSourceId(id: string): string {
  return `vendor-${String(id).toLowerCase()}`;
}

/** Whether a contact reference is a vendor's (made from `vendorContactSourceId`) or a customer's. */
export function contactPartyOf(reference: string): "customer" | "vendor" {
  const parsed = parseLaxReference(reference);
  return parsed.ok && parsed.value.kind === "contact" && parsed.value.sourceId.startsWith("vendor-")
    ? "vendor"
    : "customer";
}

/**
 * A bill paid in full from Stripe clearing. Its amount is the bill's whole total: the caller
 * passes the bill, so a payment can never be for more or less than what it pays.
 */
export function buildBillPayment(input: {
  readonly bill: Bill;
  readonly paidOn: string;
}): Result<BillPayment, DocumentCode> {
  const { bill } = input;
  const parsed = parseLaxReference(bill?.reference);
  if (!parsed.ok || parsed.value.kind !== "bill" || parsed.value.product !== bill.product) {
    return refuse("bad_reference", "a bill payment pays a bill of its own product");
  }
  const b = base("bill_payment", { product: bill.product, sourceId: parsed.value.sourceId });
  if (!b.ok) return b;
  const contact = checkRef(bill.contactReference, "contact", bill.product);
  if (!contact.ok) return contact;
  if (contactPartyOf(contact.value) !== "vendor") {
    return refuse("bad_reference", "a bill is paid to a vendor contact");
  }
  const dates = checkDates(input.paidOn);
  if (!dates.ok) return dates;
  const amount = bill.totals?.grossPence;
  if (!isPence(amount) || amount <= 0) return refuse("bad_amount", "a bill payment is positive");
  return ok({
    ...b.value,
    contactReference: contact.value,
    billReference: bill.reference,
    currency: CURRENCY,
    paidOn: input.paidOn,
    amountPence: amount,
    paidFrom: "stripe_clearing",
  });
}

function sameTotals(a: Totals, b: Totals): boolean {
  return a.netPence === b.netPence && a.vatPence === b.vatPence && a.grossPence === b.grossPence;
}

/** Rebuild an invoice through the builder and require it to equal what we were handed. */
function checkInvoice(invoice: Invoice): Result<null, DocumentCode> {
  const bad = (why: string) => refuse("bad_invoice", why);
  if (typeof invoice !== "object" || invoice === null || !Array.isArray(invoice.lines)) {
    return bad("not an invoice");
  }
  if (!PRODUCTS.includes(invoice.product) || invoice.entity !== legalEntityFor(invoice.product)) {
    return bad("product and legal entity disagree");
  }
  const parsed = parseLaxReference(invoice.reference);
  if (!parsed.ok || parsed.value.kind !== "invoice" || parsed.value.product !== invoice.product) {
    return bad("reference is not this product's invoice");
  }
  const common = {
    product: invoice.product,
    sourceId: parsed.value.sourceId,
    contactReference: invoice.contactReference,
    issuedOn: invoice.issuedOn,
    dueOn: invoice.dueOn,
  };
  const rebuilt =
    invoice.amountsAre === "tax_inclusive"
      ? buildInclusiveInvoice({
          ...common,
          number: invoice.number as string,
          lines: invoice.lines.map((l) => ({
            description: l.description,
            grossPence: lineGrossPence(l),
            vatPence: l.vatPence,
            treatment: l.treatment,
            role: l.role,
          })),
        })
      : invoice.number === undefined && invoice.amountsAre === undefined
        ? buildInvoice({
            ...common,
            lines: invoice.lines.map((l) => ({
              description: l.description,
              quantity: l.quantity,
              unitNetPence: l.unitNetPence,
              treatment: l.treatment,
              role: l.role,
            })),
          })
        : refuse("bad_invoice", "an invoice LAX numbers is VAT-inclusive");
  if (!rebuilt.ok) return bad(rebuilt.refusal.message);
  const same = rebuilt.value.lines.every(
    (l, i) => l.vatPence === invoice.lines[i]?.vatPence && invoice.lines[i]?.basis === l.basis,
  );
  if (!same || !sameTotals(rebuilt.value.totals, invoice.totals) || invoice.currency !== CURRENCY) {
    return bad("invoice lines or totals do not match");
  }
  return ok(null);
}

/** What has already been credited on one invoice line. */
interface LineLedger {
  readonly line: Line;
  readonly gross: Pence;
  creditedGross: Pence;
  creditedVat: Pence;
}

function ledgerFor(invoice: Invoice): Record<LineRole, LineLedger[]> {
  const out: Record<LineRole, LineLedger[]> = { goods: [], delivery: [] };
  for (const line of invoice.lines) {
    out[line.role].push({ line, gross: lineGrossPence(line), creditedGross: 0, creditedVat: 0 });
  }
  return out;
}

/**
 * How the VAT inside a partial credit line is chosen. `books` is the rule credits are made with;
 * `cumulative` is the rule credit notes were made with before it, kept only so that stored credit
 * notes still replay (see `creditedEntry`). A new credit is never made with it.
 */
type CreditVatRule = "books" | "cumulative";
const CREDIT_VAT_RULES: readonly CreditVatRule[] = ["books", "cumulative"];

/**
 * The VAT inside `take` gross credited on a ledger entry, or null when no VAT fits.
 *
 * `books` (the rule): Books cannot be handed the VAT of a tax-inclusive line; it works it out per
 * line as `round_half_up(gross * rate / (1 + rate))` (`vatInsideGross`). A partial credit carries
 * exactly that, so the line, and so the credit note's total (the sum of its lines), is what Books
 * computes, to the penny. Two bounds keep the line whole however it is split: the VAT credited
 * never passes the line's VAT, and what is left of the line's VAT always fits in what is left of
 * its gross (a value outside is clamped to the nearest bound: the adapter then sees it differs from
 * Books and refuses it for staff, never sends it). The credit that finishes a line takes exactly
 * the VAT left, so a fully credited line credits exactly its VAT.
 *
 * `cumulative` (before): `cumulativeVat` of the gross credited so far, less what earlier credits
 * took. About one partial credit in nine came out a penny away from Books.
 */
function creditVat(entry: LineLedger, take: Pence, rule: CreditVatRule): Pence | null {
  const after = entry.creditedGross + take;
  if (rule === "cumulative") {
    const vat = cumulativeVat(entry.line.vatPence, entry.gross, after) - entry.creditedVat;
    return vat < 0 ? null : Math.min(vat, take);
  }
  const left = entry.line.vatPence - entry.creditedVat;
  if (after >= entry.gross) return left < 0 ? null : left;
  const low = Math.max(0, left - (entry.gross - after));
  const high = Math.min(take, left);
  if (low > high) return null;
  return Math.min(high, Math.max(low, vatInsideGross(take, entry.line.treatment)));
}

/** The credit line for `take` gross on a ledger entry: VAT by `creditVat`, never over the line's. */
function nextCredit(
  entry: LineLedger,
  take: Pence,
  rule: CreditVatRule = "books",
): Result<Line, "bad_line" | "bad_invoice"> {
  const vat = creditVat(entry, take, rule);
  if (vat === null) return refuse("bad_invoice", "VAT already credited on a line is too high");
  const credit = buildInclusiveLine({
    description: `Credit: ${entry.line.description}`,
    treatment: entry.line.treatment,
    role: entry.line.role,
    grossPence: take,
    vatPence: vat,
  });
  if (!credit.ok) return refuse("bad_line", credit.refusal.message);
  return credit;
}

function record(entry: LineLedger, credit: Line): void {
  entry.creditedGross += lineGrossPence(credit);
  entry.creditedVat += credit.vatPence;
}

/** Most equal parts a finishing credit is split off into, before the part that finishes the line. */
const MAX_SPLIT_PARTS = 3;

/**
 * The credit lines for `take` gross on `entry` (one of `entries`, its role's ledger). Usually one
 * line (`nextCredit`). A credit that finishes a line must carry exactly the VAT left on it, and
 * Books rounds that line on its own, so the two can be a penny or so apart (Books' rounding of
 * the parts of a line need not add up to its rounding of the whole). Then the credit is split, on
 * the same invoice line, into `parts` equal partial credits of `size` gross and one line for the
 * rest that finishes it, chosen so that Books' VAT on every one of them (`vatInsideGross`) adds up
 * to exactly the VAT left: every line, and so the credit note's total, is what Books computes, and
 * the invoice line is still credited exactly its VAT.
 *
 * The split is deterministic: the fewest parts (up to `MAX_SPLIT_PARTS`), then the smallest size.
 * Books' rounding repeats every `period` pence of gross, so no size above one period is tried. The
 * parts are ordinary partial credits (`nextCredit`, unclamped) and the last line finishes the line,
 * so a replay rebuilds every one; a split is only used when the replay puts each part back on
 * this very line. When no split works (a rest of a few pence, or VAT that drifted further), the
 * single line is kept: it differs from Books, and the adapter refuses it for staff, never sends it.
 */
function creditLines(
  entries: readonly LineLedger[],
  entry: LineLedger,
  take: Pence,
): Result<Line[], "bad_line" | "bad_invoice"> {
  const single = nextCredit(entry, take);
  if (!single.ok) return single;
  const vat = single.value.vatPence;
  const treatment = entry.line.treatment;
  const finishes = entry.creditedGross + take >= entry.gross;
  if (!finishes || vat === vatInsideGross(take, treatment)) return ok([single.value]);
  const rate = BigInt(STANDARD_VAT_RATE_BPS);
  const whole = 10_000n + rate;
  const period = Number(whole / gcd(rate, whole));
  for (let parts = 1; parts <= MAX_SPLIT_PARTS; parts++) {
    for (let size = 1; size <= period && parts * size < take; size++) {
      const rest = take - parts * size;
      if (parts * vatInsideGross(size, treatment) + vatInsideGross(rest, treatment) !== vat) {
        continue;
      }
      const split = replayedSplit(entries, entry, [...Array(parts).fill(size), rest]);
      if (split) return ok(split);
    }
  }
  return ok([single.value]);
}

/**
 * The credit lines for `takes` on `entry`, one after another, when each rebuilds to VAT exactly as
 * Books works it out and the replay (`creditedEntry`) would put each back on `entry`; else null.
 * Works on copies: the ledger is not changed.
 */
function replayedSplit(
  entries: readonly LineLedger[],
  entry: LineLedger,
  takes: readonly Pence[],
): Line[] | null {
  let current = entry;
  let ledger = entries;
  const lines: Line[] = [];
  for (const take of takes) {
    const credit = nextCredit(current, take);
    if (
      !credit.ok ||
      credit.value.vatPence !== vatInsideGross(take, current.line.treatment) ||
      creditedEntry(ledger, credit.value) !== current
    ) {
      return null;
    }
    lines.push(credit.value);
    const next: LineLedger = {
      ...current,
      creditedGross: current.creditedGross + take,
      creditedVat: current.creditedVat + credit.value.vatPence,
    };
    const was = current;
    ledger = ledger.map((e) => (e === was ? next : e));
    current = next;
  }
  return lines;
}

function gcd(a: bigint, b: bigint): bigint {
  return b === 0n ? a : gcd(b, a % b);
}

/** Two credit lines are the same document line: what the books are sent. */
function sameCreditLine(a: Line, b: Line): boolean {
  return (
    a.description === b.description &&
    a.treatment === b.treatment &&
    a.unitNetPence === b.unitNetPence &&
    a.vatPence === b.vatPence
  );
}

/**
 * The invoice line a credit line credits: the first of its role, in invoice order, with room for
 * it, that rebuilds to exactly that credit line. A credit made line by line in order (filling) is
 * always on the first with room; one made for a named line (`line`) is on that line unless an
 * earlier line with room would rebuild to the very same credit line, and then it is recorded on
 * that earlier one, since the two cannot be told apart in the books. The builder and the replay
 * use this one rule, so a credit is always replayed onto the line it was recorded on.
 */
function creditedEntry(entries: readonly LineLedger[], line: Line): LineLedger | null {
  const take = lineGrossPence(line);
  if (take < 1) return null;
  for (const entry of entries) {
    if (take > entry.gross - entry.creditedGross) continue;
    for (const rule of CREDIT_VAT_RULES) {
      const rebuilt = nextCredit(entry, take, rule);
      if (rebuilt.ok && sameCreditLine(rebuilt.value, line)) return entry;
    }
  }
  return null;
}

/**
 * What is already credited on each line of the invoice, in invoice order, replaying `priorCredits`
 * exactly as `buildCreditNoteFor` does (refused when one does not reproduce).
 */
export function creditedOnInvoiceLines(
  invoice: Invoice,
  priorCredits: readonly CreditNote[],
): Result<Pence[], DocumentCode> {
  const checked = checkInvoice(invoice);
  if (!checked.ok) return checked;
  const replayed = replayPriorCredits(invoice, priorCredits);
  if (!replayed.ok) return replayed;
  const next: Record<LineRole, number> = { goods: 0, delivery: 0 };
  return ok(
    invoice.lines.map((line) => {
      const entry = replayed.value[line.role][next[line.role]++] as LineLedger;
      return entry.creditedGross;
    }),
  );
}

/**
 * Replay the prior credit notes onto the invoice's lines, in order, rebuilding each credit line
 * exactly as `buildCreditNoteFor` would have made it (on the line `creditedEntry` names). A prior credit that differs in any line or
 * total, or that uses more than a line holds, is refused; nothing a caller states about an
 * earlier credit is trusted beyond what the rebuild reproduces.
 */
function replayPriorCredits(
  invoice: Invoice,
  priorCredits: readonly CreditNote[],
): Result<Record<LineRole, LineLedger[]>, DocumentCode> {
  const bad = (why: string) => refuse("bad_invoice", why);
  const ledger = ledgerFor(invoice);
  for (const prior of priorCredits) {
    const priorRef = checkRef(prior.reference, "credit_note", invoice.product);
    if (!priorRef.ok || prior.invoiceReference !== invoice.reference) {
      return refuse("bad_reference", "a prior credit note belongs to another invoice");
    }
    if (typeof prior !== "object" || !Array.isArray(prior.lines) || prior.lines.length === 0) {
      return bad("a prior credit note has no lines");
    }
    for (const line of prior.lines as readonly Line[]) {
      const entries = ledger[line.role];
      if (!entries) return bad("a prior credit line has no role");
      if (line.basis !== "tax_inclusive" || line.quantity !== 1) {
        return bad("a prior credit note does not match the invoice");
      }
      const entry = creditedEntry(entries, line);
      if (!entry) return bad("a prior credit note does not match the invoice");
      record(entry, line);
    }
    if (!sameTotals(totalsOf(prior.lines), prior.totals)) {
      return bad("a prior credit note does not add up");
    }
  }
  return ok(ledger);
}

function missingPriorCredit(role: LineRole): Result<never, DocumentCode> {
  return refuse(
    "bad_invoice",
    `prior credit notes cover less ${role} than has been refunded; one may be missing`,
  );
}

/**
 * A credit note for part of an issued invoice. The lines come from the invoice's own goods and
 * delivery lines, so each keeps its VAT treatment (a margin-scheme sale is credited as margin
 * scheme, delivery as standard rated). The amounts must pass `planRefund` (never more than was
 * paid) and must fit in the invoice's goods and delivery gross minus the credit notes already
 * issued for it. `priorCredits` must hold every credit note already issued for the invoice (all
 * states except cancelled and failed), in creation order: if they cover less than `buckets` says
 * was refunded, the call is refused, since a missing one would let its VAT be credited twice.
 * Prior credits are replayed onto the invoice's lines in order and rebuilt; one that
 * does not reproduce exactly is refused. A credit line is tax-inclusive (`amountsAre`): its VAT is
 * the cumulative share of the line's VAT for the gross credited so far, less what earlier credits
 * took, so however a line is split its credits never total more VAT or gross than the invoice line
 * charged, and the credit that finishes a line takes exactly the rest. The invoice is rebuilt
 * through the same constructors as a new one, so a forged or hand-edited Invoice is refused
 * (`bad_invoice`).
 */
export function buildCreditNoteFor(
  invoice: Invoice,
  input: {
    sourceId: string;
    issuedOn: string;
    buckets: PaidBuckets;
    request: RefundSplit;
    priorCredits: readonly CreditNote[];
    /** The money given back with it (a refund that went through), if any. */
    refund?: CreditNoteRefundSource;
    /**
     * The invoice lines (indexes in `invoice.lines`, all of one role) the whole credit is for,
     * filled in that order. Absent: the credit fills the lines of each role in invoice order.
     * Given: the request must be all of their role and fit in what is left on them.
     */
    lines?: readonly number[];
  },
): Result<CreditNote, DocumentCode> {
  const checked = checkInvoice(invoice);
  if (!checked.ok) return checked;
  const b = base("credit_note", { product: invoice.product, sourceId: input.sourceId });
  if (!b.ok) return b;
  const dates = checkDates(input.issuedOn);
  if (!dates.ok) return dates;
  if (input.issuedOn < invoice.issuedOn) {
    return refuse("bad_date", "credit note is dated before the invoice");
  }
  if (input.refund !== undefined) {
    const refundDate = checkDates(input.refund.refundedOn);
    if (!refundDate.ok) return refundDate;
    if (input.refund.account !== "stripe_clearing" || input.refund.refundedOn < input.issuedOn) {
      return refuse(
        "bad_date",
        "a credit note is refunded from Stripe clearing, on or after its date",
      );
    }
  }
  const plan = planRefund(input.buckets, input.request);
  if (!plan.ok) return refuse("refund_refused", plan.refusal.message);
  if (plan.value.goodsPence + plan.value.deliveryPence === 0) {
    return refuse("zero_total", "a credit note cannot total zero");
  }
  const replayed = replayPriorCredits(invoice, input.priorCredits);
  if (!replayed.ok) return replayed;
  const ledger = replayed.value;
  const refunded: Record<LineRole, Pence> = {
    goods: input.buckets.refundedGoodsPence,
    delivery: input.buckets.refundedDeliveryPence,
  };
  for (const role of LINE_ROLES) {
    const credited = ledger[role].reduce((sum, e) => sum + e.creditedGross, 0);
    if (credited < refunded[role]) {
      return missingPriorCredit(role);
    }
  }
  const lines: Line[] = [];
  if (input.lines !== undefined) {
    const first = invoice.lines[input.lines[0] ?? -1];
    const entryOf = (index: number): LineLedger | null => {
      const line = invoice.lines[index];
      if (!Number.isInteger(index) || !line || !first || line.role !== first.role) return null;
      const position = invoice.lines.slice(0, index).filter((l) => l.role === line.role).length;
      return ledger[line.role][position] ?? null;
    };
    const entries = input.lines.map(entryOf);
    if (
      !first ||
      entries.some((entry) => entry === null) ||
      new Set(input.lines).size !== input.lines.length
    ) {
      return refuse("bad_line", "the credited lines are not lines of one role on the invoice");
    }
    const amount = plan.value[first.role === "goods" ? "goodsPence" : "deliveryPence"];
    const other = plan.value[first.role === "goods" ? "deliveryPence" : "goodsPence"];
    const room = (entries as LineLedger[]).reduce((sum, e) => sum + e.gross - e.creditedGross, 0);
    if (other !== 0 || amount > room) {
      return refuse("exceeds_invoice", "the credit exceeds what is left on its lines");
    }
    let remaining = amount;
    while (remaining > 0) {
      const entry = (entries as LineLedger[]).find((e) => e.creditedGross < e.gross);
      if (!entry) return refuse("exceeds_invoice", "the credit exceeds what is left on its lines");
      const take = Math.min(remaining, entry.gross - entry.creditedGross);
      const credit = creditLines(ledger[first.role], entry, take);
      if (!credit.ok) return credit;
      for (const line of credit.value) {
        lines.push(line);
        // Recorded where the replay will find it (this line, or one it cannot be told from).
        record(creditedEntry(ledger[first.role], line) ?? entry, line);
      }
      remaining -= take;
    }
  }
  for (const role of input.lines === undefined ? LINE_ROLES : []) {
    const amount = plan.value[role === "goods" ? "goodsPence" : "deliveryPence"];
    const left = ledger[role].reduce((sum, e) => sum + e.gross - e.creditedGross, 0);
    if (amount > left) {
      return refuse("exceeds_invoice", `${role} credit exceeds what is left on the invoice`);
    }
    let remaining = amount;
    for (const entry of ledger[role]) {
      if (remaining === 0) break;
      const take = Math.min(remaining, entry.gross - entry.creditedGross);
      if (take === 0) continue;
      const credit = creditLines(ledger[role], entry, take);
      if (!credit.ok) return credit;
      for (const line of credit.value) {
        lines.push(line);
        record(entry, line);
      }
      remaining -= take;
    }
  }
  return ok({
    ...b.value,
    amountsAre: "tax_inclusive",
    contactReference: invoice.contactReference,
    invoiceReference: invoice.reference,
    currency: CURRENCY,
    issuedOn: input.issuedOn,
    lines,
    totals: totalsOf(lines),
    ...(input.refund
      ? { refund: { account: input.refund.account, refundedOn: input.refund.refundedOn } }
      : {}),
  });
}

/** A payment with allocations to one or more invoices; the allocations can never exceed the payment. */
export function buildPayment(
  input: Common & {
    contactReference: string;
    receivedOn: string;
    amountPence: Pence;
    allocations: readonly PaymentAllocation[];
  },
): Result<Payment, DocumentCode> {
  const b = base("payment", input);
  if (!b.ok) return b;
  const contact = checkRef(input.contactReference, "contact", input.product);
  if (!contact.ok) return contact;
  const dates = checkDates(input.receivedOn);
  if (!dates.ok) return dates;
  if (!isPence(input.amountPence) || input.amountPence <= 0) {
    return refuse("bad_amount", "payment must be positive whole pence");
  }
  let allocated = 0;
  for (const a of input.allocations) {
    if (!isPence(a.amountPence) || a.amountPence <= 0) {
      return refuse("bad_allocation", "each allocation must be positive whole pence");
    }
    const ref = checkRef(a.invoiceReference, "invoice", input.product);
    if (!ref.ok) return ref;
    allocated += a.amountPence;
  }
  const refs = input.allocations.map((a) => a.invoiceReference);
  if (new Set(refs).size !== refs.length) {
    return refuse("bad_allocation", "an invoice can appear once per payment");
  }
  if (allocated > input.amountPence) {
    return refuse("over_allocated", "allocations exceed the payment");
  }
  return ok({
    ...b.value,
    contactReference: contact.value,
    currency: CURRENCY,
    receivedOn: input.receivedOn,
    amountPence: input.amountPence,
    allocations: [...input.allocations].sort((a, b) =>
      compareText(a.invoiceReference, b.invoiceReference),
    ),
    unallocatedPence: input.amountPence - allocated,
  });
}

/** What finance reads on an expense or transfer: printable ASCII, no line breaks, at most 100. */
const DESCRIPTION = /^[\x20-\x7e]{1,100}$/;

function checkMovement(input: {
  readonly date: string;
  readonly amountPence: Pence;
  readonly description: string;
}): Result<null, DocumentCode> {
  const dates = checkDates(input.date);
  if (!dates.ok) return dates;
  if (!isPence(input.amountPence) || input.amountPence <= 0) {
    return refuse("bad_amount", "an expense or transfer must be positive whole pence");
  }
  if (typeof input.description !== "string" || !DESCRIPTION.test(input.description)) {
    return refuse("bad_name", "a description is 1-100 printable characters");
  }
  return ok(null);
}

/** Stripe's fees on one balance transaction, paid out of the Stripe clearing account. */
export function buildExpense(
  input: Common & {
    readonly category: Expense["category"];
    readonly spentOn: string;
    readonly amountPence: Pence;
    readonly description: string;
  },
): Result<Expense, DocumentCode> {
  const b = base("expense", input);
  if (!b.ok) return b;
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) {
    return refuse("bad_line", "unknown expense category");
  }
  const checked = checkMovement({ ...input, date: input.spentOn });
  if (!checked.ok) return checked;
  return ok({
    ...b.value,
    category: input.category,
    paidFrom: "stripe_clearing",
    currency: CURRENCY,
    spentOn: input.spentOn,
    amountPence: input.amountPence,
    description: input.description,
  });
}

/** One Stripe payout: from the Stripe clearing account to the bank account. */
export function buildTransfer(
  input: Common & {
    readonly transferredOn: string;
    readonly amountPence: Pence;
    readonly description: string;
  },
): Result<Transfer, DocumentCode> {
  const b = base("transfer", input);
  if (!b.ok) return b;
  const checked = checkMovement({ ...input, date: input.transferredOn });
  if (!checked.ok) return checked;
  return ok({
    ...b.value,
    from: "stripe_clearing",
    to: "bank",
    currency: CURRENCY,
    transferredOn: input.transferredOn,
    amountPence: input.amountPence,
    description: input.description,
  });
}

/** A Stripe object id as Stripe writes it: a lower-case prefix, `_`, then letters and digits. */
const STRIPE_ID = /^[a-z]{1,8}_[A-Za-z0-9]{1,48}$/;

/**
 * The source id of a document that comes from a Stripe object (a balance transaction, a payout).
 * Stripe ids are case-sensitive and source ids are lower case, so each capital letter is written
 * as `-` and the letter (`txn_1AbC` -> `txn_1-ab-c`). Stripe ids never hold `-`, so no two ids give
 * the same source id; `stripeIdFromSourceId` reads it back.
 */
export function stripeSourceId(stripeId: string): Result<string, "bad_source_id"> {
  if (typeof stripeId !== "string" || !STRIPE_ID.test(stripeId)) {
    return refuse("bad_source_id", "not a Stripe object id");
  }
  const encoded = stripeId.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return SOURCE_ID.test(encoded) ? ok(encoded) : refuse("bad_source_id", "Stripe id is too long");
}

/** The Stripe id behind a source id made by `stripeSourceId`, or null for any other text. */
export function stripeIdFromSourceId(sourceId: string): string | null {
  if (typeof sourceId !== "string" || !SOURCE_ID.test(sourceId)) return null;
  if (/-(?![a-z])/.test(sourceId)) return null;
  const decoded = sourceId.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return STRIPE_ID.test(decoded) ? decoded : null;
}

/**
 * The totals a provider must report back for this document. Priced documents use their own totals;
 * a payment is its amount with no VAT; a contact has no money, so all zero.
 */
export function expectedTotals(document: AccountingDocument): Totals {
  switch (document.kind) {
    case "invoice":
    case "credit_note":
    case "bill":
      return document.totals;
    case "payment":
    case "expense":
    case "transfer":
    case "bill_payment":
      return { netPence: document.amountPence, vatPence: 0, grossPence: document.amountPence };
    case "contact":
      return { netPence: 0, vatPence: 0, grossPence: 0 };
  }
}
