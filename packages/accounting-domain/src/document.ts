import { CURRENCY, type Line, type Pence, type Totals, isPence, totalsOf } from "./money.js";
import { type Result, ok, refuse } from "./result.js";

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

const REFERENCE_PREFIX: Readonly<Record<DocumentKind, string>> = {
  invoice: "INV",
  payment: "PAY",
  credit_note: "CN",
  bill: "BILL",
  contact: "CON",
};

const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/**
 * The stable LAX reference of a document: the same kind and source id always give the same text,
 * so it doubles as the duplicate guard and the key for looking a document up in a provider.
 */
export function laxReference(
  kind: DocumentKind,
  sourceId: string,
): Result<string, "bad_source_id"> {
  if (!SOURCE_ID.test(sourceId)) {
    return refuse("bad_source_id", "source id must be 1-64 letters, digits, '_' or '-'");
  }
  return ok(`LAX-${REFERENCE_PREFIX[kind]}-${sourceId}`);
}

export type DocumentCode =
  | "bad_date"
  | "no_lines"
  | "bad_amount"
  | "bad_allocation"
  | "over_allocated"
  | "bad_name"
  | "bad_reference";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

interface Common {
  readonly product: Product;
  readonly reference: string;
}

function base<K extends DocumentKind>(kind: K, c: Common): Base<K> {
  return { kind, reference: c.reference, product: c.product, entity: legalEntityFor(c.product) };
}

function checkDates(...dates: string[]): Result<null, "bad_date"> {
  return dates.every((d) => ISO_DATE.test(d))
    ? ok(null)
    : refuse("bad_date", "dates are YYYY-MM-DD");
}

export function buildContact(
  input: Common & { name: string; email?: string | null },
): Result<Contact, DocumentCode> {
  if (input.name.trim() === "") return refuse("bad_name", "contact needs a name");
  return ok({ ...base("contact", input), name: input.name.trim(), email: input.email ?? null });
}

export function buildInvoice(
  input: Common & {
    contactReference: string;
    issuedOn: string;
    dueOn: string;
    lines: readonly Line[];
  },
): Result<Invoice, DocumentCode> {
  const dates = checkDates(input.issuedOn, input.dueOn);
  if (!dates.ok) return dates;
  if (input.dueOn < input.issuedOn) return refuse("bad_date", "due date is before issue date");
  if (input.lines.length === 0) return refuse("no_lines", "an invoice needs at least one line");
  return ok({
    ...base("invoice", input),
    contactReference: input.contactReference,
    currency: CURRENCY,
    issuedOn: input.issuedOn,
    dueOn: input.dueOn,
    lines: input.lines,
    totals: totalsOf(input.lines),
  });
}

export function buildCreditNote(
  input: Common & {
    contactReference: string;
    invoiceReference: string;
    issuedOn: string;
    lines: readonly Line[];
  },
): Result<CreditNote, DocumentCode> {
  const dates = checkDates(input.issuedOn);
  if (!dates.ok) return dates;
  if (input.lines.length === 0) return refuse("no_lines", "a credit note needs at least one line");
  return ok({
    ...base("credit_note", input),
    contactReference: input.contactReference,
    invoiceReference: input.invoiceReference,
    currency: CURRENCY,
    issuedOn: input.issuedOn,
    lines: input.lines,
    totals: totalsOf(input.lines),
  });
}

export function buildBill(
  input: Common & {
    contactReference: string;
    issuedOn: string;
    dueOn: string;
    lines: readonly Line[];
  },
): Result<Bill, DocumentCode> {
  const dates = checkDates(input.issuedOn, input.dueOn);
  if (!dates.ok) return dates;
  if (input.dueOn < input.issuedOn) return refuse("bad_date", "due date is before issue date");
  if (input.lines.length === 0) return refuse("no_lines", "a bill needs at least one line");
  return ok({
    ...base("bill", input),
    contactReference: input.contactReference,
    currency: CURRENCY,
    issuedOn: input.issuedOn,
    dueOn: input.dueOn,
    lines: input.lines,
    totals: totalsOf(input.lines),
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
    ...base("payment", input),
    contactReference: input.contactReference,
    currency: CURRENCY,
    receivedOn: input.receivedOn,
    amountPence: input.amountPence,
    allocations: [...input.allocations].sort((a, b) =>
      a.invoiceReference.localeCompare(b.invoiceReference),
    ),
    unallocatedPence: input.amountPence - allocated,
  });
}
