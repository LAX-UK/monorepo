import { isValidIsoDate } from "./dates.js";
import {
  CURRENCY,
  LINE_ROLES,
  type Line,
  type LineInput,
  type LineRole,
  MAX_LINES,
  type Pence,
  type Totals,
  buildInclusiveLine,
  buildLine,
  cumulativeVat,
  isPence,
  lineGrossPence,
  totalsOf,
} from "./money.js";
import { type PaidBuckets, type RefundSplit, planRefund } from "./refund.js";
import { type Result, ok, refuse } from "./result.js";
import { compareText } from "./text.js";

export const DOCUMENT_KINDS = ["invoice", "payment", "credit_note", "bill", "contact"] as const;
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

export type AccountingDocument = Contact | Invoice | CreditNote | Bill | Payment;

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
  const rebuilt = buildInvoice({
    product: invoice.product,
    sourceId: parsed.value.sourceId,
    contactReference: invoice.contactReference,
    issuedOn: invoice.issuedOn,
    dueOn: invoice.dueOn,
    lines: invoice.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unitNetPence: l.unitNetPence,
      treatment: l.treatment,
      role: l.role,
    })),
  });
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

/** The credit line for `take` gross on a ledger entry: VAT allocated cumulatively, never over the line's. */
function nextCredit(entry: LineLedger, take: Pence): Result<Line, "bad_line" | "bad_invoice"> {
  const vat =
    cumulativeVat(entry.line.vatPence, entry.gross, entry.creditedGross + take) - entry.creditedVat;
  if (vat < 0) return refuse("bad_invoice", "VAT already credited on a line is too high");
  const credit = buildInclusiveLine({
    description: `Credit: ${entry.line.description}`,
    treatment: entry.line.treatment,
    role: entry.line.role,
    grossPence: take,
    vatPence: Math.min(vat, take),
  });
  if (!credit.ok) return refuse("bad_line", credit.refusal.message);
  return credit;
}

function record(entry: LineLedger, credit: Line): void {
  entry.creditedGross += lineGrossPence(credit);
  entry.creditedVat += credit.vatPence;
}

/**
 * Replay the prior credit notes onto the invoice's lines, in order, rebuilding each credit line
 * exactly as `buildCreditNoteFor` would have made it. A prior credit that differs in any line or
 * total, or that uses more than a line holds, is refused; nothing a caller states about an
 * earlier credit is trusted beyond what the rebuild reproduces.
 */
function replayPriorCredits(
  invoice: Invoice,
  priorCredits: readonly CreditNote[],
): Result<Record<LineRole, LineLedger[]>, DocumentCode> {
  const bad = (why: string) => refuse("bad_invoice", why);
  const ledger = ledgerFor(invoice);
  const cursor: Record<LineRole, number> = { goods: 0, delivery: 0 };
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
      while (
        cursor[line.role] < entries.length &&
        (entries[cursor[line.role]] as LineLedger).creditedGross >=
          (entries[cursor[line.role]] as LineLedger).gross
      ) {
        cursor[line.role] += 1;
      }
      const entry = entries[cursor[line.role]];
      if (!entry || line.basis !== "tax_inclusive" || line.quantity !== 1) {
        return bad("a prior credit note does not match the invoice");
      }
      const take = lineGrossPence(line);
      const rebuilt =
        take >= 1 && take <= entry.gross - entry.creditedGross ? nextCredit(entry, take) : null;
      if (
        !rebuilt?.ok ||
        rebuilt.value.description !== line.description ||
        rebuilt.value.treatment !== line.treatment ||
        rebuilt.value.unitNetPence !== line.unitNetPence ||
        rebuilt.value.vatPence !== line.vatPence
      ) {
        return bad("a prior credit note does not match the invoice");
      }
      record(entry, rebuilt.value);
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
  for (const role of LINE_ROLES) {
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
      const credit = nextCredit(entry, take);
      if (!credit.ok) return credit;
      lines.push(credit.value);
      record(entry, credit.value);
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
      return { netPence: document.amountPence, vatPence: 0, grossPence: document.amountPence };
    case "contact":
      return { netPence: 0, vatPence: 0, grossPence: 0 };
  }
}
